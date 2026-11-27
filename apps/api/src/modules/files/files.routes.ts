/* apps/api/src/modules/files/files.routes.ts */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema } from '../../common/openapi-schemas.js';
import { AppError } from '../../common/errors.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { prisma } from '../../common/prisma.js';
import { randomUUID } from 'node:crypto';
import { putFile, readLocalFile, verifyLocalSignature } from '../../common/storage.js';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const FileQuerySchema = z
  .object({
    expires: z.coerce.number(),
    sig: z.string(),
  })
  .openapi('FileDownloadQuery');

export const filesRouter = Router();

// Serves locally-stored exports (STORAGE_PROVIDER=local). In S3 mode this
// route is unused — downloads go straight to the bucket via presigned URLs.
registry.registerPath({
  method: 'get',
  path: '/{key}',
  tags: ['Files'],
  description: 'Download a stored file with a signed URL (local storage provider only)',
  responses: {
    200: { description: 'File content' },
    403: {
      description: 'Invalid or expired signature',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

filesRouter.get('/*key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storageProvider = process.env.STORAGE_PROVIDER ?? 'local';

    if (storageProvider !== 'local') {
      throw new AppError(404, 'Not found', 'NOT_FOUND');
    }

    const key = (req.params as Record<string, string>)[0];
    const { expires, sig } = FileQuerySchema.parse(req.query);

    if (!verifyLocalSignature(key, expires, sig)) {
      throw new AppError(403, 'Invalid or expired download link', 'SIGNATURE_INVALID');
    }

    const content = await readLocalFile(key);
    const ext = key.split('.').pop();
    const contentType =
      ext === 'pdf' ? 'application/pdf' : ext === 'csv' ? 'text/csv' : 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(content);
  } catch (err) {
    next(err);
  }
});

// ─── Catalog images (P65/P66): staff upload for the booking page + QR menu. ───
filesRouter.post(
  '/images',
  authMiddleware,
  tenantScope,
  requirePermission('property', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as { contentBase64?: string; name?: string };
      if (!body.contentBase64 || !body.name?.trim()) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'contentBase64 + name required' },
        });
      }
      const ext = String(body.name).split('.').pop()?.toLowerCase() ?? '';
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Images only (png/jpg/jpeg/webp)' },
        });
      }
      const buf = Buffer.from(String(body.contentBase64), 'base64');
      if (!buf.length || buf.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Image must be non-empty and under 5MB' },
        });
      }
      const key = `catalog/${req.tenantId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
      await putFile(key, buf, MIME[ext] ?? 'image/png');
      return res.status(201).json({ data: { key } });
    } catch (err) {
      return next(err);
    }
  }
);

// ─── 4.4 Reservation documents: metadata rows + content via putFile. ───
const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  csv: 'text/csv',
  txt: 'text/plain',
};

filesRouter.post(
  '/documents',
  authMiddleware,
  tenantScope,
  requirePermission('reservation', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as {
        reservationId?: string;
        name?: string;
        category?: string;
        signatureStatus?: string;
        deadline?: string;
        contentBase64?: string;
      };
      if (!body.reservationId || !body.name?.trim() || !body.contentBase64) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'reservationId, name and contentBase64 are required',
          },
        });
      }
      const buf = Buffer.from(String(body.contentBase64), 'base64');
      if (!buf.length || buf.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'File must be non-empty and under 5MB' },
        });
      }
      const ext = String(body.name).split('.').pop()?.toLowerCase() ?? 'bin';
      const key = `documents/${body.reservationId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
      await putFile(key, buf, MIME[ext] ?? 'application/octet-stream');
      const doc = await prisma.reservationDocument.create({
        data: {
          tenantId: req.tenantId,
          reservationId: String(body.reservationId),
          key,
          name: String(body.name).trim(),
          category: body.category ?? 'other',
          signatureStatus: body.signatureStatus ?? 'n_a',
          deadline: body.deadline ? new Date(body.deadline) : null,
          uploadedBy: ((req as any).user?.userId ?? (req as any).user?.id ?? null) as string | null,
        },
      });
      return res.json({ data: doc });
    } catch (err) {
      return next(err);
    }
  }
);

filesRouter.get(
  '/documents',
  authMiddleware,
  tenantScope,
  requirePermission('reservation', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = String((req.query as Record<string, string>).reservationId ?? '');
      if (!reservationId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'reservationId is required' } });
      }
      const docs = await prisma.reservationDocument.findMany({
        where: { tenantId: req.tenantId, reservationId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          category: true,
          signatureStatus: true,
          signedAt: true,
          deadline: true,
          createdAt: true,
        },
      });
      return res.json({ data: docs });
    } catch (err) {
      return next(err);
    }
  }
);

filesRouter.patch(
  '/documents/:id',
  authMiddleware,
  tenantScope,
  requirePermission('reservation', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as {
        signatureStatus?: string;
        signedAt?: string;
        deadline?: string | null;
      };
      const doc = await prisma.reservationDocument.updateMany({
        where: { id: String((req.params as { id: string }).id), tenantId: req.tenantId },
        data: {
          ...(body.signatureStatus ? { signatureStatus: body.signatureStatus } : {}),
          signedAt: body.signedAt ? new Date(body.signedAt) : undefined,
          deadline:
            body.deadline === null ? null : body.deadline ? new Date(body.deadline) : undefined,
        },
      });
      if (doc.count === 0) {
        return res
          .status(404)
          .json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
      }
      return res.json({ data: { updated: doc.count } });
    } catch (err) {
      return next(err);
    }
  }
);
