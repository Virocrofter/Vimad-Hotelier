import { Router, type Request, type Response, type NextFunction } from 'express';
import { moveFolioItem } from './group-billing.service.js';
import { prisma } from '../../common/prisma.js';
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { validateBody, validateQuery } from '../../common/validate.js';
import { paginationSchema } from '../../common/pagination.js';
import {
  ErrorResponseSchema,
  IdParamSchema,
  PaginatedResponseSchema,
} from '../../common/openapi-schemas.js';
import {
  createFolio,
  deleteFolio,
  getFolio,
  listFolios,
  postCharge,
  postPayment,
  reverseCharge,
  transferToCityLedger,
  folioCreateSchema,
  chargeSchema,
  paymentSchema,
  type FolioCreateInput,
} from './folios.service.js';
import { attachPropertyScope } from '../auth/auth.middleware.js';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const folioQuerySchema = paginationSchema
  .extend({
    reservationId: z.string().optional(),
    status: z.enum(['open', 'closed', 'transferred']).optional(),
  })
  .openapi('FolioQuery');
const FolioCreateInputSchema = folioCreateSchema.openapi('FolioCreateInput');
const ChargeInputSchema = chargeSchema.openapi('ChargeInput');
const PaymentInputSchema = paymentSchema.openapi('PaymentInput');
const ReverseChargeInputSchema = z.object({ reason: z.string() }).openapi('ReverseChargeInput');

const FolioItemSchema = z
  .object({
    id: z.string(),
    reservationId: z.string(),
    type: z.enum(['guest', 'master', 'split']),
    status: z.enum(['open', 'closed', 'transferred']),
    totalCharges: z.number(),
    totalPayments: z.number(),
    balance: z.number(),
    name: z.string().optional(),
    createdAt: z.date().or(z.string()).optional(),
    updatedAt: z.date().or(z.string()).optional(),
  })
  .openapi('FolioItem');

const FolioItemDetailSchema = FolioItemSchema.extend({
  items: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        description: z.string(),
        amount: z.number(),
        quantity: z.number().int(),
        postedAt: z.date().or(z.string()),
      })
    )
    .optional(),
}).openapi('FolioItemDetail');

const FolioResponseSchema = z.object({ data: FolioItemDetailSchema }).openapi('FolioResponse');
const FolioListResponseSchema =
  PaginatedResponseSchema(FolioItemSchema).openapi('FolioListResponse');

const FolioTransactionItemSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    description: z.string(),
    amount: z.number(),
    quantity: z.number().int(),
    postedAt: z.date().or(z.string()),
  })
  .openapi('FolioTransactionItem');

const FolioTransactionResponseSchema = z
  .object({ data: FolioTransactionItemSchema })
  .openapi('FolioTransactionResponse');

const FolioIdChargeIdParamSchema = z
  .object({ id: z.string(), chargeId: z.string() })
  .openapi('FolioIdChargeIdParam');

export const foliosRouter = Router();

foliosRouter.use(authMiddleware, tenantScope);
foliosRouter.use(attachPropertyScope);

registry.registerPath({
  method: 'get',
  path: '/',
  tags: ['Folios'],
  description: 'List folios',
  request: {
    query: folioQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of folios',
      content: { 'application/json': { schema: FolioListResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.get(
  '/',
  requirePermission('folio', 'read'),
  validateQuery(folioQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listFolios(
        req.tenantId,
        req.validatedQuery as {
          page: number;
          pageSize: number;
          reservationId?: string;
          status?: string;
        },
        req.effectivePropertyIds ?? undefined
      );
      res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

registry.registerPath({
  method: 'get',
  path: '/{id}',
  tags: ['Folios'],
  description: 'Get a folio by ID',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: 'Folio details',
      content: { 'application/json': { schema: FolioResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Folio not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.get(
  '/:id',
  requirePermission('folio', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getFolio(req.tenantId, req.params.id);
      res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

registry.registerPath({
  method: 'post',
  path: '/',
  tags: ['Folios'],
  description: 'Create a folio',
  request: {
    body: {
      description: 'Folio payload',
      content: { 'application/json': { schema: FolioCreateInputSchema } },
    },
  },
  responses: {
    201: {
      description: 'Folio created',
      content: { 'application/json': { schema: FolioResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Reservation not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Folio already exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.post(
  '/',
  requirePermission('folio', 'create'),
  validateBody(folioCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createFolio(req.tenantId, req.validatedBody as FolioCreateInput);
      res.status(201).json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

registry.registerPath({
  method: 'post',
  path: '/{id}/charges',
  tags: ['Folios'],
  description: 'Post a charge to a folio',
  request: {
    params: IdParamSchema,
    body: {
      description: 'Charge payload',
      content: { 'application/json': { schema: ChargeInputSchema } },
    },
  },
  responses: {
    201: {
      description: 'Charge posted',
      content: { 'application/json': { schema: FolioTransactionResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Folio not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Folio is closed',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.post(
  '/:id/charges',
  requirePermission('folio', 'update'),
  validateBody(chargeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await postCharge(
        req.tenantId,
        req.params.id,
        req.validatedBody as z.infer<typeof chargeSchema>
      );
      res.status(201).json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

registry.registerPath({
  method: 'post',
  path: '/{id}/charges/{chargeId}/reverse',
  tags: ['Folios'],
  description: 'Reverse a charge on a folio',
  request: {
    params: FolioIdChargeIdParamSchema,
    body: {
      description: 'Reverse reason',
      content: { 'application/json': { schema: ReverseChargeInputSchema } },
    },
  },
  responses: {
    200: {
      description: 'Charge reversed',
      content: { 'application/json': { schema: FolioTransactionResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Folio or charge not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Cannot reverse adjustment',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.post(
  '/:id/charges/:chargeId/reverse',
  requirePermission('folio', 'update'),
  validateBody(z.object({ reason: z.string() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reverseCharge(
        req.tenantId,
        req.params.id,
        req.params.chargeId,
        (req.validatedBody as { reason: string }).reason
      );
      res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

registry.registerPath({
  method: 'post',
  path: '/{id}/payments',
  tags: ['Folios'],
  description: 'Post a payment to a folio',
  request: {
    params: IdParamSchema,
    body: {
      description: 'Payment payload',
      content: { 'application/json': { schema: PaymentInputSchema } },
    },
  },
  responses: {
    201: {
      description: 'Payment posted',
      content: { 'application/json': { schema: FolioTransactionResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Folio not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Folio is closed',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.post(
  '/:id/payments',
  requirePermission('folio', 'update'),
  validateBody(paymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await postPayment(
        req.tenantId,
        req.params.id,
        req.validatedBody as z.infer<typeof paymentSchema>
      );
      res.status(201).json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

registry.registerPath({
  method: 'post',
  path: '/{id}/transfer-to-city-ledger',
  tags: ['Folios'],
  description: 'Transfer a folio to the city ledger',
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: 'Folio transferred',
      content: { 'application/json': { schema: FolioResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Folio not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Folio must be open to transfer',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.post(
  '/:id/transfer-to-city-ledger',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await transferToCityLedger(req.tenantId, req.params.id);
      res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

registry.registerPath({
  method: 'delete',
  path: '/{id}',
  tags: ['Folios'],
  description: 'Delete a folio',
  request: {
    params: IdParamSchema,
  },
  responses: {
    204: {
      description: 'Folio deleted',
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Folio not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Folio has posted items',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

foliosRouter.delete(
  '/:id',
  requirePermission('folio', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteFolio(req.tenantId, req.params.id);
      res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

// ─── Charge-to-room (Phase 3): staff posts an ad-hoc charge to an
// in-house guest's master folio through the postCharge chokepoint. ───
foliosRouter.post(
  '/charge-to-room',
  requirePermission('folio', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as {
        reservationId?: string;
        description?: string;
        amount?: number;
      };
      if (
        !body.reservationId ||
        !body.description ||
        !Number(body.amount) ||
        Number(body.amount) <= 0
      ) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'reservationId, description and a positive amount are required',
          },
        });
      }
      const reservation = await prisma.reservation.findFirst({
        where: { id: String(body.reservationId), tenantId: req.tenantId },
        include: { folios: { orderBy: { createdAt: 'asc' }, take: 1 } },
      });
      if (!reservation || reservation.status !== 'checked_in') {
        return res.status(409).json({
          error: {
            code: 'NOT_IN_HOUSE',
            message: 'Charge-to-room requires a checked-in reservation',
          },
        });
      }
      const folio = reservation.folios?.[0];
      if (!folio) {
        return res
          .status(409)
          .json({ error: { code: 'NO_FOLIO', message: 'Reservation has no folio' } });
      }
      const data = await postCharge(req.tenantId, folio.id, {
        type: 'incidental',
        description: String(body.description),
        amount: Number(body.amount),
        quantity: 1,
        postedAt: new Date(),
      });
      return res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);

// ─── Split bills: move a line item between a reservation's folios. ───
foliosRouter.post(
  '/move-item',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId, targetFolioId } = (req.body ?? {}) as {
        itemId?: string;
        targetFolioId?: string;
      };
      if (!itemId || !targetFolioId) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'itemId and targetFolioId are required' },
        });
      }
      const actor = ((req as any).user?.userId ?? (req as any).user?.id ?? null) as string | null;
      const data = await moveFolioItem(req.tenantId, actor, String(itemId), String(targetFolioId));
      return res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);
