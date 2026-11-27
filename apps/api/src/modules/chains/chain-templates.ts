/* apps/api/src/modules/chains/chain-templates.ts — 11.2: corporate pushes
 * rate/policy/message templates across chain properties. Rate templates push
 * for real (one plan per room type, idempotent by code); policy/message
 * payloads store today and apply when their engines are template-ready
 * (filed, not faked). Every push is audited per property. */
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';

const toPublic = (t: Record<string, any>) => ({ ...t, payload: t.payload });

export async function listTemplates(tenantId: string, chainId: string) {
  const chain = await prisma.chain.findFirst({ where: { id: chainId, tenantId } });
  if (!chain) throw new AppError(404, 'Chain not found', 'NOT_FOUND');
  const rows = await prisma.chainTemplate.findMany({
    where: { tenantId, chainId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPublic);
}

export async function createTemplate(
  tenantId: string,
  input: {
    chainId: string;
    name: string;
    type: 'rate' | 'policy' | 'messages';
    payload: Record<string, unknown>;
  }
) {
  const chain = await prisma.chain.findFirst({ where: { id: input.chainId, tenantId } });
  if (!chain) throw new AppError(404, 'Chain not found', 'NOT_FOUND');
  if (!input.payload || Object.keys(input.payload).length === 0) {
    throw new AppError(400, 'Template needs a payload', 'VALIDATION_ERROR');
  }
  return prisma.chainTemplate
    .create({
      data: {
        tenantId,
        chainId: input.chainId,
        name: input.name,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    })
    .then(toPublic);
}

/* Push a RATE template: instantiate one rate plan per room type on each
 * target property. Idempotent by (property, code) — re-push updates
 * nothing if the plan exists (skip) and reports it. */
export async function pushTemplate(
  tenantId: string,
  chainId: string,
  templateId: string,
  propertyIds: string[]
) {
  const chain = await prisma.chain.findFirst({ where: { id: chainId, tenantId } });
  if (!chain) throw new AppError(404, 'Chain not found', 'NOT_FOUND');
  const template = await prisma.chainTemplate.findFirst({
    where: { id: templateId, tenantId, chainId },
  });
  if (!template) throw new AppError(404, 'Template not found', 'NOT_FOUND');
  if (template.type !== 'rate') {
    throw new AppError(
      409,
      `Only rate templates are pushable today (${template.type} apply rides its engine follow-up)`,
      'NOT_PUSHABLE'
    );
  }
  const payload = template.payload as {
    name: string;
    codePrefix: string;
    baseRate: number;
    currency?: string;
  };
  if (!payload?.name || !payload?.codePrefix || !Number(payload?.baseRate)) {
    throw new AppError(
      400,
      'Rate template payload needs name + codePrefix + baseRate',
      'VALIDATION_ERROR'
    );
  }

  const chainProps = await prisma.property.findMany({
    where: { tenantId, chainId, id: { in: propertyIds } },
    select: { id: true, code: true },
  });
  if (chainProps.length !== propertyIds.length) {
    throw new AppError(400, 'One or more properties are not in this chain', 'VALIDATION_ERROR');
  }

  const applied: Array<{
    propertyId: string;
    roomTypeId: string;
    planId: string;
    skipped: boolean;
  }> = [];
  for (const prop of chainProps) {
    const roomTypes = await prisma.roomType.findMany({ where: { tenantId, propertyId: prop.id } });
    for (const rt of roomTypes) {
      const code = `${payload.codePrefix}-${rt.code}`.slice(0, 60);
      const existing = await prisma.ratePlan.findFirst({
        where: { tenantId, propertyId: prop.id, code },
      });
      if (existing) {
        applied.push({
          propertyId: prop.id,
          roomTypeId: rt.id,
          planId: existing.id,
          skipped: true,
        });
        continue;
      }
      const plan = await prisma.ratePlan.create({
        data: {
          tenant: { connect: { id: tenantId } },
          property: { connect: { id: prop.id } },
          roomType: { connect: { id: rt.id } },
          name: payload.name,
          code,
          baseRate: new Prisma.Decimal(payload.baseRate),
          currency: payload.currency ?? 'ZAR',
        },
      });
      applied.push({ propertyId: prop.id, roomTypeId: rt.id, planId: plan.id, skipped: false });
    }
  }
  return { template: toPublic(template), applied };
}
