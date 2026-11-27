/* apps/api/src/modules/leads/leads.service.ts
 * [MARKETING-LEADS] Phase 0+ — public lead capture for the marketing site.
 * Unauthenticated (prospects have no login): the site POSTs here and the
 * lead lands in the `leads` table + an alert email to the founder inbox.
 * POPIA: `consent` must be explicitly true (privacy-notice checkbox).
 */
import { z } from 'zod';
import { prisma } from '../../common/prisma.js';
import { sendEmail } from '../../jobs/email.queue.js';
import { env } from '../../common/env.js';
import { logger } from '../../common/logger.js';

export const createLeadSchema = z.object({
  source: z.enum(['contact', 'demo', 'quote', 'ebook']),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(24).optional(),
  propertyName: z.string().trim().max(160).optional(),
  roomCount: z.coerce.number().int().min(1).max(5000).optional(),
  currentPms: z.string().trim().max(120).optional(),
  message: z.string().max(4000).optional(),
  consent: z.literal(true, { message: 'POPIA consent is required' }),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  page: z.string().trim().max(300).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildLeadAlertHtml(lead: CreateLeadInput): string {
  const row = (label: string, value?: string | number | null) =>
    value === undefined || value === null || value === ''
      ? ''
      : `<tr><td style="padding:4px 12px 4px 0;color:#888;vertical-align:top;">${label}</td>` +
        `<td style="padding:4px 0;font-weight:600;">${escapeHtml(String(value))}</td></tr>`;

  const utm = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ');

  return `
    <h2 style="margin:0 0 4px;">New Vimad lead — ${escapeHtml(lead.source)}</h2>
    <p style="margin:0 0 16px;color:#888;font-size:13px;">via vimad.io${lead.page ? ` · ${escapeHtml(lead.page)}` : ''}</p>
    <table style="border-collapse:collapse;font-size:14px;">
      ${row('Name', lead.name)}
      ${row('Email', lead.email)}
      ${row('Phone / WhatsApp', lead.phone)}
      ${row('Property', lead.propertyName)}
      ${row('Rooms', lead.roomCount)}
      ${row('Current PMS', lead.currentPms)}
      ${row('UTM', utm || undefined)}
    </table>
    ${lead.message ? `<p style="background:#f8f7fc;border-radius:8px;padding:12px 16px;white-space:pre-line;">${escapeHtml(lead.message)}</p>` : ''}
  `;
}

export async function createLead(input: CreateLeadInput) {
  const lead = await prisma.lead.create({
    data: {
      source: input.source,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      propertyName: input.propertyName ?? null,
      roomCount: input.roomCount ?? null,
      currentPms: input.currentPms ?? null,
      message: input.message ?? null,
      consent: input.consent,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      page: input.page ?? null,
    },
  });

  // Notification loop (Phase 0+): the lead must reach a human inbox.
  // Email failure must never lose the lead — the row is already stored.
  try {
    await sendEmail({
      to: env.LEAD_NOTIFY_EMAIL ?? env.OPS_EMAIL,
      subject: `New Vimad lead — ${input.source}: ${input.name}`,
      template: 'generic',
      payload: { message: buildLeadAlertHtml(input) },
      relatedType: 'lead',
      relatedId: lead.id,
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { notifiedAt: new Date() } });
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'lead alert email failed — lead row preserved');
  }

  return lead;
}
