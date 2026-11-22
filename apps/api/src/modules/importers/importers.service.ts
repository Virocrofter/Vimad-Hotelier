/* C5′ — importers: one engine, three format adapters (NightsBridge CSV,
 * Semper CSV, iCal). Pipeline: parse -> normalize -> validate -> dedupe ->
 * dry-run | commit. Every run persists an ImportRun report (P29) — zero
 * silent failures by design. */
import { prisma } from '../../common/prisma.js';

export type ImportFormat = 'nightsbridge' | 'semper' | 'ical';

export interface RawRow {
  row: number;
  fields: Record<string, string>;
}

export interface NormalizedRow extends RawRow {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  arrivalDate: string | null; // YYYY-MM-DD
  departureDate: string | null;
  confirmationNumber: string | null;
  roomTypeName: string | null;
  adults: number | null;
  errors: string[];
  duplicate: boolean;
}

/* ─── parsers ─── */

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function unfoldICal(content: string): string[] {
  const out: string[] = [];
  for (const l of content.split(/\r\n|\n/)) {
    if (/^[ \t]/.test(l) && out.length) out[out.length - 1] += l.slice(1);
    else out.push(l);
  }
  return out;
}

export function parseICal(content: string): Record<string, string>[] {
  const events: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of unfoldICal(content)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const m = line.match(/^([A-Z-]+)(?:;[^:]*)?:(.*)$/);
      if (m) cur[m[1]] = m[2];
    }
  }
  return events;
}

/* ─── adapters: raw content -> field maps ─── */

const HEADER_ALIASES: Record<ImportFormat, Record<string, string[]>> = {
  nightsbridge: {
    firstName: ['first name', 'firstname', 'given'],
    lastName: ['last name', 'lastname', 'surname', 'family'],
    email: ['email', 'e-mail'],
    phone: ['phone', 'mobile', 'tel'],
    arrivalDate: ['arrival', 'arrive', 'check in', 'checkin', 'from'],
    departureDate: ['departure', 'depart', 'check out', 'checkout', 'to'],
    confirmationNumber: ['conf', 'reference', 'res no', 'reservation', 'booking ref'],
    roomTypeName: ['room type', 'roomtype', 'category'],
    adults: ['adults', 'pax'],
  },
  semper: {
    firstName: ['first', 'guest first'],
    lastName: ['last', 'surname', 'guest last'],
    email: ['email'],
    phone: ['phone', 'mobile'],
    arrivalDate: ['arrive', 'arrival', 'in'],
    departureDate: ['depart', 'departure', 'out'],
    confirmationNumber: ['res no', 'reservation no', 'conf'],
    roomTypeName: ['room', 'type'],
    adults: ['adults', 'pax'],
  },
  ical: {},
};

function csvToRows(format: ImportFormat, content: string): RawRow[] {
  const grid = parseCsv(content);
  if (grid.length < 2) return [];
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const aliases = HEADER_ALIASES[format];
  const col: Record<string, number> = {};
  for (const [field, names] of Object.entries(aliases)) {
    col[field] = header.findIndex((h) => names.some((a) => h.includes(a)));
  }
  return grid.slice(1).map((cells, i) => {
    const fields: Record<string, string> = {};
    for (const [f, idx] of Object.entries(col)) {
      if (idx >= 0 && cells[idx]) fields[f] = cells[idx].trim();
    }
    return { row: i + 2, fields };
  });
}

function icalToRows(content: string): RawRow[] {
  return parseICal(content).map((ev, i) => {
    const desc = ev['DESCRIPTION'] ?? '';
    const kv = (k: string) =>
      desc
        .split('\n')
        .find((l) => l.toLowerCase().startsWith(k.toLowerCase() + ':'))
        ?.split(':')
        .slice(1)
        .join(':')
        .trim() ?? '';
    const name = ev['SUMMARY'] ?? '';
    const [firstName = '', ...rest] = name.trim().split(/\s+/);
    return {
      row: i + 1,
      fields: {
        firstName,
        lastName: rest.join(' ') || undefined || '',
        email: kv('email') || undefined || '',
        phone: kv('phone') || undefined || '',
        arrivalDate: (ev['DTSTART'] ?? '').slice(0, 8),
        departureDate: (ev['DTEND'] ?? '').slice(0, 8),
        confirmationNumber: ev['UID'] ?? '',
      },
    };
  });
}

/* ─── normalize + validate ─── */

function parseDate(s: string | null): string | null {
  if (!s) return null;
  let m = s.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function normalize(format: ImportFormat, content: string): NormalizedRow[] {
  const raw = format === 'ical' ? icalToRows(content) : csvToRows(format, content);
  return raw.map((r) => {
    const f = r.fields;
    const arrivalDate = parseDate(f.arrivalDate ?? null);
    const departureDate = parseDate(f.departureDate ?? null);
    const errors: string[] = [];
    if (!f.firstName && !f.lastName) errors.push('guest name missing');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) errors.push('email malformed');
    if (!arrivalDate) errors.push('arrival date missing/unparseable');
    if (!departureDate) errors.push('departure date missing/unparseable');
    if (arrivalDate && departureDate && departureDate <= arrivalDate)
      errors.push('departure must be after arrival');
    return {
      ...r,
      firstName: f.firstName || null,
      lastName: f.lastName || null,
      email: f.email || null,
      phone: f.phone || null,
      arrivalDate,
      departureDate,
      confirmationNumber: f.confirmationNumber || null,
      roomTypeName: f.roomTypeName || null,
      adults: f.adults ? Number(f.adults) : null,
      errors,
      duplicate: false,
    };
  });
}

/* ─── dedupe + run ─── */

export interface ImportInput {
  format: ImportFormat;
  content: string;
  propertyId?: string;
  mode: 'dry_run' | 'commit';
  actorId?: string | null;
}

export async function runImport(tenantId: string, input: ImportInput) {
  const rows = normalize(input.format, input.content);
  let duplicate = 0;
  const created = { guests: 0, reservations: 0 };

  for (const r of rows) {
    if (r.errors.length > 0) continue;
    if (r.email) {
      const g = await prisma.guest.findFirst({ where: { tenantId, email: r.email } });
      if (g) {
        r.duplicate = true;
        duplicate++;
        continue;
      }
    }
    if (r.confirmationNumber) {
      const res = await prisma.reservation.findFirst({
        where: { tenantId, confirmationNumber: r.confirmationNumber },
      });
      if (res) {
        r.duplicate = true;
        duplicate++;
        continue;
      }
    }
    if (input.mode === 'commit') {
      if (!input.propertyId) {
        r.errors.push('propertyId required for commit');
        continue;
      }
      const guest = await prisma.guest.create({
        data: {
          tenantId,
          firstName: r.firstName ?? '',
          lastName: r.lastName ?? '',
          email: r.email,
          phone: r.phone,
        },
      });
      created.guests++;
      const arr = new Date(r.arrivalDate + 'T00:00:00Z');
      const dep = new Date(r.departureDate + 'T00:00:00Z');
      await prisma.reservation.create({
        data: {
          tenantId,
          propertyId: input.propertyId,
          guestId: guest.id,
          confirmationNumber: r.confirmationNumber ?? `IMP-${input.format.toUpperCase()}-${r.row}`,
          status: 'confirmed',
          arrivalDate: arr,
          departureDate: dep,
          nights: Math.max(1, Math.round((dep.getTime() - arr.getTime()) / 86400_000)),
          adults: r.adults ?? 1,
          totalAmount: 0,
          balance: 0,
        },
      });
      created.reservations++;
    }
  }

  const valid = rows.filter((r) => r.errors.length === 0 && !r.duplicate).length;
  const report = {
    total: rows.length,
    valid,
    duplicate,
    errors: rows
      .filter((r) => r.errors.length > 0)
      .map((r) => ({ row: r.row, messages: r.errors })),
    created: input.mode === 'commit' ? created : undefined,
    propertyId: input.propertyId ?? null,
  };

  const run = await prisma.importRun.create({
    data: {
      tenantId,
      propertyId: input.propertyId ?? null,
      format: input.format,
      mode: input.mode,
      report: report as any,
      actorId: input.actorId ?? null,
    },
  });
  return { runId: run.id, report };
}
