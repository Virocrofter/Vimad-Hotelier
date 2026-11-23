/* apps/api/src/modules/housekeeping/housekeeping.supervisor.routes.ts — T2
 * Supervisor (dept-head) surface: reassignment, force overrides, unassigned
 * pool, SLA board. Every mutating call writes an audit_log row so the task
 * lifecycle is auditable end to end.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { resolveAuditPropertyId } from '../audit/audit-property.js';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/auth.middleware.js';
import { validateBody } from '../../common/validate.js';
import { AppError } from '../../common/errors.js';
import { prisma } from '../../common/prisma.js';

export const housekeepingSupervisorRouter = Router();

housekeepingSupervisorRouter.use(authMiddleware);

/* ─── Shared audit helper — imported by tasks.service.ts so T1
   transitions (create/claim/complete) are audited too ─── */
export async function auditTask(
  tenantId: string,
  userId: string | undefined,
  action: string,
  taskId: string,
  metadata: Record<string, unknown>,
  ip?: string
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: userId ?? null,
      action,
      entity: 'task',
      entityId: taskId,
      propertyId: await resolveAuditPropertyId(tenantId, 'task', taskId),
      metadata: metadata as unknown as Prisma.InputJsonValue,
      ipAddress: ip,
    },
  });
}

/* ─── GET /board — one call powers the whole supervisor view ─── */
housekeepingSupervisorRouter.get(
  '/board',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).auth;
      const department = (req.query.department as string) ?? 'housekeeping';

      const [tasks, staff] = await Promise.all([
        prisma.task.findMany({
          where: {
            tenantId,
            department,
            status: { in: ['open', 'in_progress'] },
          },
          include: {
            room: { select: { number: true } },
            assignee: { select: { id: true, firstName: true, lastName: true } },
            guest: { select: { firstName: true, lastName: true } },
          },
          orderBy: [{ slaBreached: 'desc' }, { dueAt: 'asc' }],
          take: 500,
        }),
        prisma.user.findMany({
          where: { tenantId, status: 'active' },
          select: { id: true, firstName: true, lastName: true, role: true },
          orderBy: { firstName: 'asc' },
        }),
      ]);

      const unassignedPool = tasks.filter((t) => !t.assigneeId);
      const slaBreached = tasks.filter((t) => t.slaBreached);
      const byAssignee = staff
        .map((s) => ({
          assignee: s,
          tasks: tasks.filter((t) => t.assigneeId === s.id),
        }))
        .filter((g) => g.tasks.length > 0);

      res.json({
        data: {
          staff,
          unassignedPool,
          byAssignee,
          slaBreached,
          summary: {
            open: tasks.length,
            unassigned: unassignedPool.length,
            breached: slaBreached.length,
            dueWithin60Min: tasks.filter(
              (t) => t.dueAt && !t.slaBreached && t.dueAt.getTime() - Date.now() < 60 * 60 * 1000
            ).length,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ─── POST /tasks/:id/reassign — supervisor moves a task ─── */
housekeepingSupervisorRouter.post(
  '/tasks/:id/reassign',
  requirePermission('task', 'assign'),
  validateBody(z.object({ assigneeId: z.string().min(1), note: z.string().max(500).optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      const { assigneeId, note } = req.validatedBody as { assigneeId: string; note?: string };

      const [task, assignee] = await Promise.all([
        prisma.task.findFirst({ where: { id: req.params.id, tenantId: auth.tenantId } }),
        prisma.user.findFirst({
          where: { id: assigneeId, tenantId: auth.tenantId, status: 'active' },
        }),
      ]);
      if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');
      if (!assignee) throw new AppError(404, 'Assignee not found or inactive', 'NOT_FOUND');
      if (task.assigneeId === assigneeId) {
        throw new AppError(409, 'Task is already assigned to this user', 'CONFLICT');
      }
      if (task.status === 'done' || task.status === 'cancelled') {
        throw new AppError(409, `Cannot reassign a ${task.status} task`, 'CONFLICT');
      }

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { assigneeId, status: task.status === 'open' ? 'open' : 'in_progress' },
      });

      await auditTask(
        auth.tenantId,
        auth.user.id,
        'task.reassign',
        task.id,
        {
          from: task.assigneeId,
          to: assigneeId,
          note: note ?? null,
        },
        req.ip
      );

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

/* ─── POST /tasks/:id/override — force-complete / reopen / cancel ─── */
housekeepingSupervisorRouter.post(
  '/tasks/:id/override',
  requirePermission('task', 'assign'),
  validateBody(
    z.object({
      action: z.enum(['force-complete', 'reopen', 'cancel']),
      note: z.string().min(1).max(500),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      const { action, note } = req.validatedBody as {
        action: 'force-complete' | 'reopen' | 'cancel';
        note: string;
      };

      const task = await prisma.task.findFirst({
        where: { id: req.params.id, tenantId: auth.tenantId },
      });
      if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');

      const data =
        action === 'force-complete'
          ? { status: 'done', completedAt: new Date(), completedBy: auth.user.id }
          : action === 'reopen'
            ? { status: 'open', completedAt: null, completedBy: null }
            : { status: 'cancelled' };

      if (task.status === (data as { status: string }).status) {
        throw new AppError(409, `Task is already ${task.status}`, 'CONFLICT');
      }

      const updated = await prisma.task.update({ where: { id: task.id }, data });

      await auditTask(
        auth.tenantId,
        auth.user.id,
        `task.override_${action}`,
        task.id,
        {
          previousStatus: task.status,
          note,
        },
        req.ip
      );

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

/* ─── GET /tasks/:id/audit — full lifecycle trail for one task ─── */
housekeepingSupervisorRouter.get(
  '/tasks/:id/audit',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).auth;
      const entries = await prisma.auditLog.findMany({
        where: { tenantId, entity: 'task', entityId: req.params.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ data: entries });
    } catch (err) {
      next(err);
    }
  }
);

/* ─── GET /space-report — rooms grouped by floor with status + next arrival.
 * The "floor state without scrolling" surface for the supervisor. ─── */
housekeepingSupervisorRouter.get(
  '/space-report',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).auth;
      const propertyId = String((req.query as any).propertyId ?? '');
      if (!propertyId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      }
      const today = new Date();
      const rooms = await prisma.room.findMany({
        where: { tenantId, propertyId },
        include: { roomType: { select: { name: true } } },
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      });
      const roomIds = rooms.map((r) => r.id);
      const openTasks = await prisma.task.findMany({
        where: {
          tenantId,
          propertyId,
          roomId: { in: roomIds },
          status: { in: ['open', 'in_progress'] },
        },
        select: { roomId: true, assigneeId: true },
      });
      const attendantByRoom = new Map<string, string | null>();
      for (const t of openTasks) {
        if (t.roomId && !attendantByRoom.has(t.roomId)) attendantByRoom.set(t.roomId, t.assigneeId);
      }
      const nextStays = await prisma.reservationStay.findMany({
        where: {
          roomId: { in: roomIds },
          date: { gte: today },
          reservation: { tenantId, propertyId, status: 'confirmed' },
        },
        include: { reservation: { select: { arrivalDate: true } } },
        orderBy: { date: 'asc' },
      });
      const nextByRoom = new Map<string, string>();
      for (const st of nextStays) {
        if (!nextByRoom.has(st.roomId)) {
          nextByRoom.set(
            st.roomId,
            (st.reservation.arrivalDate as Date).toISOString().slice(0, 10)
          );
        }
      }
      const byFloor = new Map<string, any[]>();
      for (const r of rooms) {
        const floor = r.floor ?? '—';
        if (!byFloor.has(floor)) byFloor.set(floor, []);
        byFloor.get(floor)!.push({
          id: r.id,
          number: r.number,
          floor,
          category: r.roomType?.name ?? null,
          housekeepingStatus: r.housekeepingStatus,
          serviceStatus: r.serviceStatus,
          serviceReason: r.serviceReason,
          attendantId: attendantByRoom.get(r.id) ?? null,
          nextArrival: nextByRoom.get(r.id) ?? null,
        });
      }
      const floors = [...byFloor.entries()].map(([floor, roomsArr]) => ({
        floor,
        rooms: roomsArr,
        counts: roomsArr.reduce((acc: Record<string, number>, r) => {
          const k = r.serviceStatus !== 'active' ? 'blocked' : r.housekeepingStatus;
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
      }));
      return res.json({ data: { floors, totalRooms: rooms.length } });
    } catch (err) {
      return next(err);
    }
  }
);

/* ─── POST /tasks/bulk-assign — assign many open tasks to one attendant. ─── */
housekeepingSupervisorRouter.post(
  '/tasks/bulk-assign',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).auth;
      const { taskIds, assigneeId } = (req.body ?? {}) as any;
      if (!Array.isArray(taskIds) || taskIds.length === 0 || !assigneeId) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'taskIds (non-empty array) and assigneeId are required',
          },
        });
      }
      const ids = taskIds.map(String).slice(0, 200);
      const result = await prisma.task.updateMany({
        where: { tenantId, id: { in: ids }, status: { in: ['open', 'in_progress'] } },
        data: { assigneeId: String(assigneeId) },
      });
      return res.json({ data: { updated: result.count } });
    } catch (err) {
      return next(err);
    }
  }
);
