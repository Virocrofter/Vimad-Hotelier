/* Stage 4.5 - onboarding progress API. Tenant-scoped, same auth as tenant-settings. */
import { Router } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { getProgress, recordStep, dismissProgress, ONBOARDING_STEPS } from './progress.service.js';
import type { OnboardingStep } from './progress.service.js';

export const onboardingProgressRouter = Router();
onboardingProgressRouter.use(authMiddleware);

onboardingProgressRouter.get('/', async (req, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const propertyId = String(req.query.propertyId ?? '') || null;
    return res.json({ data: await getProgress({ tenantId, propertyId }) });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

onboardingProgressRouter.put('/step', async (req, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const { step, action, answers, propertyId } = req.body ?? {};
    if (!(ONBOARDING_STEPS as readonly string[]).includes(step))
      return res.status(400).json({ error: 'unknown step' });
    if (!['completed', 'skipped'].includes(action))
      return res.status(400).json({ error: 'action must be completed or skipped' });
    return res.json({
      data: await recordStep(
        { tenantId, propertyId: propertyId ?? null },
        step as OnboardingStep,
        action,
        answers
      ),
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

onboardingProgressRouter.post('/dismiss', async (req, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const propertyId = String(req.body?.propertyId ?? '') || null;
    return res.json({ data: await dismissProgress({ tenantId, propertyId }) });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// Demo -> real bridge (addendum #9 "make it real"). One-way: clears tenants.isDemo.
// TODO(drift session): audit row + owner-only permission gate.
onboardingProgressRouter.post('/make-real', async (req, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isDemo: true },
    });
    if (!tenant) return res.status(404).json({ error: 'tenant not found' });
    if (tenant.isDemo !== true)
      return res.status(400).json({ error: 'tenant is not in demo mode' });
    await prisma.tenant.update({ where: { id: tenantId }, data: { isDemo: false } });
    return res.json({ data: { madeReal: true } });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});
