/* Stage 4.5 polish - provisioning: wizard answers become real objects.
 * Best-effort by contract: provisioning failure NEVER blocks step recording.
 * Property creation is idempotent per tenant (only when zero properties).
 */
import { randomBytes } from 'crypto';
import { prisma } from '../../common/prisma.js';
import { createProperty } from '../properties/properties.service.js';

export async function provisionFromStep(
  tenantId: string,
  step: string,
  answers: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    if (step === 'property') {
      const count = await prisma.property.count({ where: { tenantId } });
      if (count > 0) return { property: 'exists' };
      const name = String(answers.propertyName ?? '').trim() || 'My Property';
      const code = 'PROP-' + randomBytes(2).toString('hex').toUpperCase();
      await createProperty(tenantId, {
        code,
        name,
        address: '',
        timezone: 'Africa/Johannesburg',
        currency: 'ZAR',
      } as never);
      return { property: 'created' };
    }
    if (step === 'rooms') {
      const n = parseInt(String(answers.roomCount ?? ''), 10);
      if (!Number.isFinite(n) || n <= 0) return { rooms: 0 };
      const property = await prisma.property.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      });
      if (!property) return { rooms: 0, reason: 'no-property' };
      let roomType = await prisma.roomType.findFirst({
        where: { tenantId, propertyId: property.id, name: 'Standard' },
      });
      if (!roomType)
        roomType = await prisma.roomType.create({
          data: { tenantId, propertyId: property.id, name: 'Standard', code: 'STD' },
        });
      const existing = await prisma.room.count({ where: { propertyId: property.id } });
      const target = Math.max(0, n - existing);
      for (let i = 0; i < target; i++) {
        await prisma.room.create({
          data: {
            tenantId,
            propertyId: property.id,
            roomTypeId: roomType.id,
            number: String(100 + existing + i + 1),
          },
        });
      }
      return { rooms: target };
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  return {};
}
