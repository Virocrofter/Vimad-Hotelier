/* apps/api/src/modules/automations/automation.service.ts — Phase 13 engine.
 * WORKFLOW (event/cron trigger) → STEP tree (condition | delay | action,
 * parentStepId reserved for branching) → RUN with execution_trace → STORAGE.
 * Structured forms + execution log, NOT a visual canvas — the trace IS the
 * trust layer. Actions: create_task (real task sink), folio_item (via the
 * sellProduct chokepoint), log. Resumes use a progress cursor so no action
 * ever fires twice. */
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { createTask } from '../tasks/tasks.service.js';
import { sellProduct } from '../upsell/upsell.service.js';

const getByPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);

const renderTemplate = (template: string, ctx: Record<string, unknown>): string =>
  template.replace(/\{\{([\w.]+)\}\}/g, (_, p: string) => {
    const v = getByPath(ctx, p);
    return v === null || v === undefined ? '' : String(v);
  });

interface Cond {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists' | 'truthy';
  value?: unknown;
}

function matchesCondition(cond: Cond, ctx: Record<string, unknown>): boolean {
  const val = getByPath(ctx, cond.field);
  switch (cond.op) {
    case 'eq':
      return val === cond.value;
    case 'neq':
      return val !== cond.value;
    case 'gt':
      return Number(val) > Number(cond.value);
    case 'gte':
      return Number(val) >= Number(cond.value);
    case 'lt':
      return Number(val) < Number(cond.value);
    case 'lte':
      return Number(val) <= Number(cond.value);
    case 'contains':
      return String(val ?? '')
        .toLowerCase()
        .includes(String(cond.value ?? '').toLowerCase());
    case 'exists':
      return val !== null && val !== undefined && val !== '';
    case 'truthy':
      return Boolean(val);
    default:
      return true;
  }
}

/* ─── Workflow CRUD ─── */

export async function createWorkflow(
  tenantId: string,
  input: {
    name: string;
    description?: string;
    triggerType: 'event' | 'cron' | 'manual';
    eventKey?: string;
    cronMinutes?: number;
    propertyId?: string;
    steps: Array<{ type: 'condition' | 'delay' | 'action'; config: Record<string, unknown> }>;
  }
) {
  if (input.triggerType === 'event' && !input.eventKey?.trim()) {
    throw new AppError(400, 'event workflows need an eventKey', 'VALIDATION_ERROR');
  }
  if (input.triggerType === 'cron' && (!input.cronMinutes || input.cronMinutes < 1)) {
    throw new AppError(400, 'cron workflows need cronMinutes >= 1', 'VALIDATION_ERROR');
  }
  if (!input.steps?.length) {
    throw new AppError(400, 'A workflow needs at least one step', 'VALIDATION_ERROR');
  }
  for (const s of input.steps) {
    if (s.type === 'action') {
      const t = (s.config as { type?: string }).type;
      if (!['create_task', 'folio_item', 'log'].includes(t ?? '')) {
        throw new AppError(400, `Unknown action type "${t}"`, 'VALIDATION_ERROR');
      }
    }
  }
  if (input.propertyId) {
    const p = await prisma.property.findFirst({ where: { id: input.propertyId, tenantId } });
    if (!p) throw new AppError(404, 'Property not found', 'NOT_FOUND');
  }

  const workflow = await prisma.automationWorkflow.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description ?? null,
      triggerType: input.triggerType,
      eventKey: input.eventKey ?? null,
      cronMinutes: input.cronMinutes ?? null,
      propertyId: input.propertyId ?? null,
      isActive: true,
    },
  });
  for (let i = 0; i < input.steps.length; i++) {
    await prisma.automationStep.create({
      data: {
        tenantId,
        workflowId: workflow.id,
        type: input.steps[i].type,
        config: input.steps[i].config as unknown as Prisma.InputJsonValue,
        sortOrder: i,
      },
    });
  }
  return getWorkflow(tenantId, workflow.id);
}

export async function getWorkflow(tenantId: string, id: string) {
  const w = await prisma.automationWorkflow.findFirst({ where: { id, tenantId } });
  if (!w) throw new AppError(404, 'Workflow not found', 'NOT_FOUND');
  const steps = await prisma.automationStep.findMany({
    where: { workflowId: w.id },
    orderBy: { sortOrder: 'asc' },
  });
  return { ...w, steps };
}

export async function listWorkflows(tenantId: string) {
  const rows = await prisma.automationWorkflow.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return Promise.all(rows.map((w) => getWorkflow(tenantId, w.id)));
}

/* ─── Execution ─── */

type TraceEntry = {
  stepId: string;
  type: string;
  at: string;
  detail: string;
};

async function executeRun(runId: string) {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run) throw new AppError(404, 'Run not found', 'NOT_FOUND');

  const steps = await prisma.automationStep.findMany({
    where: { workflowId: run.workflowId },
    orderBy: { sortOrder: 'asc' },
  });
  const payload = (run.triggerPayload ?? {}) as Record<string, unknown>;
  const trace = (run.executionTrace as TraceEntry[]) ?? [];

  let idx = run.progress;
  for (; idx < steps.length; idx++) {
    const step = steps[idx];
    const cfg = (step.config ?? {}) as Record<string, unknown>;

    if (step.type === 'condition') {
      const all = (cfg.all as Cond[] | undefined) ?? [];
      const ok = all.every((c) => matchesCondition(c, payload));
      trace.push({
        stepId: step.id,
        type: 'condition',
        at: new Date().toISOString(),
        detail: ok ? `matched (${all.length} condition(s))` : 'not matched — run stops',
      });
      if (!ok) {
        await finishRun(run.id, 'skipped', trace, idx + 1);
        return prisma.automationRun.findUnique({ where: { id: run.id } });
      }
    } else if (step.type === 'delay') {
      const minutes = Math.max(0, Number(cfg.minutes ?? 0));
      trace.push({
        stepId: step.id,
        type: 'delay',
        at: new Date().toISOString(),
        detail: `waiting ${minutes}m`,
      });
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'waiting',
          resumeAt: new Date(Date.now() + minutes * 60_000),
          executionTrace: trace as unknown as Prisma.InputJsonValue,
          progress: idx + 1,
        },
      });
      return prisma.automationRun.findUnique({ where: { id: run.id } });
    } else {
      const actionType = String(cfg.type ?? 'log');
      let detail = '';
      if (actionType === 'create_task') {
        const propertyId = String(cfg.propertyId ?? '');
        if (!propertyId)
          throw new AppError(400, 'create_task needs a propertyId', 'VALIDATION_ERROR');
        const task = await createTask(
          run.tenantId,
          {
            propertyId,
            department: String(cfg.department ?? 'management'),
            title: renderTemplate(String(cfg.title ?? 'Automation task'), payload).slice(0, 200),
            description: cfg.description
              ? renderTemplate(String(cfg.description), payload)
              : `Workflow run ${run.id}`,
            priority: (cfg.priority as 'low' | 'normal' | 'high' | 'urgent') ?? 'normal',
            reservationId: (payload.reservationId as string) ?? undefined,
            metadata: { automationRunId: run.id },
          },
          'automation'
        );
        detail = `task ${task.id} created`;
      } else if (actionType === 'folio_item') {
        const reservationId = String(cfg.reservationId ?? payload.reservationId ?? '');
        const productId = String(cfg.productId ?? '');
        const quantity = Math.max(1, Number(cfg.quantity ?? 1));
        if (!reservationId || !productId) {
          throw new AppError(400, 'folio_item needs reservationId + productId', 'VALIDATION_ERROR');
        }
        await sellProduct(run.tenantId, 'automation', { productId, quantity, reservationId });
        detail = `folio item posted (product ${productId} × ${quantity})`;
      } else {
        detail = String(cfg.message ?? 'log');
      }
      trace.push({
        stepId: step.id,
        type: 'action',
        at: new Date().toISOString(),
        detail,
      });
    }
  }
  await finishRun(run.id, 'completed', trace, idx);
  return prisma.automationRun.findUnique({ where: { id: run.id } });
}

async function finishRun(runId: string, status: string, trace: TraceEntry[], progress: number) {
  await prisma.automationRun.update({
    where: { id: runId },
    data: {
      status,
      executionTrace: trace as unknown as Prisma.InputJsonValue,
      progress,
      finishedAt: new Date(),
      resumeAt: null,
    },
  });
}

/* Exported for the manual-fire route (same execution engine). */
export const executeRunForRoutes = executeRun;

/* Fire an event trigger: every active matching workflow gets a run. */
export async function fireTrigger(
  tenantId: string,
  eventKey: string,
  payload: Record<string, unknown>
) {
  const workflows = await prisma.automationWorkflow.findMany({
    where: { tenantId, isActive: true, triggerType: 'event', eventKey },
  });
  const runs = [];
  for (const w of workflows) {
    const run = await prisma.automationRun.create({
      data: {
        tenantId,
        workflowId: w.id,
        status: 'running',
        triggerPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    runs.push(await executeRun(run.id));
  }
  return { fired: runs.length, runs };
}

/* Cron tick: fire due cron workflows with an empty payload. */
export async function runCronTick() {
  const workflows = await prisma.automationWorkflow.findMany({
    where: { isActive: true, triggerType: 'cron' },
  });
  const now = Date.now();
  let fired = 0;
  for (const w of workflows) {
    const due = !w.lastFiredAt || w.lastFiredAt.getTime() + (w.cronMinutes ?? 0) * 60_000 <= now;
    if (!due) continue;
    await prisma.automationWorkflow.update({
      where: { id: w.id },
      data: { lastFiredAt: new Date() },
    });
    const run = await prisma.automationRun.create({
      data: {
        tenantId: w.tenantId,
        workflowId: w.id,
        status: 'running',
        triggerPayload: { firedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue,
      },
    });
    await executeRun(run.id);
    fired += 1;
  }
  return { fired };
}

/* Resume waiting runs whose delay elapsed — the progress cursor guarantees
 * no step re-fires. */
export async function resumeDueRuns(now: Date = new Date(), tenantId?: string) {
  const due = await prisma.automationRun.findMany({
    where: { status: 'waiting', resumeAt: { lte: now }, ...(tenantId ? { tenantId } : {}) },
    take: 50,
  });
  const resumed = [];
  for (const r of due) resumed.push(await executeRun(r.id));
  return { resumed: resumed.length, runs: resumed };
}

export async function listRuns(tenantId: string, workflowId?: string) {
  return prisma.automationRun.findMany({
    where: { tenantId, ...(workflowId ? { workflowId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getRun(tenantId: string, id: string) {
  const run = await prisma.automationRun.findFirst({ where: { id, tenantId } });
  if (!run) throw new AppError(404, 'Run not found', 'NOT_FOUND');
  return run;
}

/* ─── Storage ─── */

export async function storageSet(tenantId: string, key: string, value: unknown) {
  const existing = await prisma.automationStorage.findFirst({ where: { tenantId, key } });
  if (existing) {
    return prisma.automationStorage.update({
      where: { id: existing.id },
      data: { value: value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue) },
    });
  }
  return prisma.automationStorage.create({
    data: { tenantId, key, value: value as Prisma.InputJsonValue },
  });
}

export async function storageGet(tenantId: string, key: string) {
  return prisma.automationStorage.findFirst({ where: { tenantId, key } });
}
