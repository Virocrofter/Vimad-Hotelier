/* apps/api/src/modules/leads/leads.service.test.ts
 * [MARKETING-LEADS] Unit tests — schema validation, HTML escaping, alert body.
 * DB-free: runs in CI without a database.
 */
import { describe, expect, it } from 'vitest';
import { buildLeadAlertHtml, createLeadSchema, escapeHtml } from './leads.service.js';

const validLead = {
  source: 'quote',
  name: 'Thandi Nkosi',
  email: 'thandi@grangegardens.co.za',
  phone: '+27 82 000 0000',
  propertyName: 'Grange Gardens',
  roomCount: 33,
  currentPms: 'NightsBridge',
  message: 'Currently on NightsBridge, want to see the OS.',
  consent: true,
  utmSource: 'google',
  page: '/pricing',
};

describe('createLeadSchema', () => {
  it('accepts a valid quote lead', () => {
    const parsed = createLeadSchema.parse(validLead);
    expect(parsed.source).toBe('quote');
    expect(parsed.roomCount).toBe(33);
  });

  it('rejects without explicit POPIA consent', () => {
    expect(() => createLeadSchema.parse({ ...validLead, consent: false })).toThrow();
    expect(() => createLeadSchema.parse({ ...validLead, consent: undefined })).toThrow();
  });

  it('rejects malformed email', () => {
    expect(() => createLeadSchema.parse({ ...validLead, email: 'not-an-email' })).toThrow();
  });

  it('rejects unknown source', () => {
    expect(() => createLeadSchema.parse({ ...validLead, source: 'spam' })).toThrow();
  });

  it('rejects out-of-range roomCount', () => {
    expect(() => createLeadSchema.parse({ ...validLead, roomCount: 0 })).toThrow();
    expect(() => createLeadSchema.parse({ ...validLead, roomCount: 99999 })).toThrow();
  });
});

describe('escapeHtml / buildLeadAlertHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });

  it('never leaks raw script tags from lead input into the alert email', () => {
    const html = buildLeadAlertHtml({
      ...validLead,
      message: '<script>alert(1)</script>',
      name: '<b>Mr X</b>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Mr X</b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders known fields and skips empty ones', () => {
    const html = buildLeadAlertHtml({ ...validLead, phone: undefined, currentPms: '' });
    expect(html).toContain('Grange Gardens');
    expect(html).toContain('33');
    expect(html).not.toContain('Phone / WhatsApp');
    expect(html).not.toContain('Current PMS');
  });
});
