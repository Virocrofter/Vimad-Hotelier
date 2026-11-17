/* Stage 4.5 - onboarding progress engine (addendum #9).
 * One row per (tenant, property|null). Steps skippable, progress resumable,
 * dismissal preserves state. Backed by the additive P19 model only.
 */
import { prisma } from '../../common/prisma.js';
import { provisionFromStep } from './provisioning.js';
import type { Prisma } from '@prisma/client';

export const ONBOARDING_STEPS = [
  'welcome',
  'property',
  'rooms',
  'rates_taxes',
  'operating_rhythm',
  'people',
  'guest_facing',
  'data',
  'go_live',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
type Scope = { tenantId: string; propertyId?: string | null };

async function findRow(scope: Scope) {
  return prisma.onboardingProgress.findFirst({
    where: { tenantId: scope.tenantId, propertyId: scope.propertyId ?? null },
    orderBy: { updatedAt: 'desc' },
  });
}

function summarize(
  row: { completedSteps: string[]; skippedSteps: string[]; answers: unknown; status: string } | null
) {
  const done = new Set([...(row?.completedSteps ?? []), ...(row?.skippedSteps ?? [])]);
  const next = ONBOARDING_STEPS.find((s) => !done.has(s)) ?? null;
  return {
    activeStep: next,
    isComplete: next === null,
    completedSteps: row?.completedSteps ?? [],
    skippedSteps: row?.skippedSteps ?? [],
    answers: (row?.answers as Record<string, unknown>) ?? {},
    status: row?.status ?? 'in_progress',
    percent: Math.round((done.size / ONBOARDING_STEPS.length) * 100),
  };
}

export async function getProgress(scope: Scope) {
  const base = summarize(await findRow(scope));
  const [tenant, propertyCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: scope.tenantId }, select: { createdAt: true } }),
    prisma.property.count({ where: { tenantId: scope.tenantId } }),
  ]);
  const fresh = tenant?.createdAt ? Date.now() - tenant.createdAt.getTime() < 7 * 86400_000 : false;
  return { ...base, suggested: fresh && propertyCount === 0 };
}

export async function recordStep(
  scope: Scope,
  step: OnboardingStep,
  action: 'completed' | 'skipped',
  answers?: Record<string, unknown>
) {
  const existing = await findRow(scope);
  const completed = new Set(existing?.completedSteps ?? []);
  const skipped = new Set(existing?.skippedSteps ?? []);
  if (action === 'completed') {
    completed.add(step);
    skipped.delete(step);
  } else {
    skipped.add(step);
    completed.delete(step);
  }
  const done = new Set([...completed, ...skipped]);
  const status =
    done.size >= ONBOARDING_STEPS.length
      ? 'done'
      : existing?.status === 'dismissed'
        ? 'in_progress'
        : (existing?.status ?? 'in_progress');
  const data = {
    tenantId: scope.tenantId,
    propertyId: scope.propertyId ?? null,
    completedSteps: [...completed],
    skippedSteps: [...skipped],
    answers: {
      ...((existing?.answers as object) ?? {}),
      ...(answers ?? {}),
    } as Prisma.InputJsonValue,
    status,
  };
  if (existing) await prisma.onboardingProgress.update({ where: { id: existing.id }, data });
  else await prisma.onboardingProgress.create({ data });
  const provisioned =
    action === 'completed' ? await provisionFromStep(scope.tenantId, step, answers ?? {}) : {};
  return { ...(await getProgress(scope)), provisioned };
}

export async function dismissProgress(scope: Scope) {
  const existing = await findRow(scope);
  if (!existing) {
    await prisma.onboardingProgress.create({
      data: { tenantId: scope.tenantId, propertyId: scope.propertyId ?? null, status: 'dismissed' },
    });
  } else if (existing.status !== 'done') {
    await prisma.onboardingProgress.update({
      where: { id: existing.id },
      data: { status: 'dismissed' },
    });
  }
  return getProgress(scope);
}
