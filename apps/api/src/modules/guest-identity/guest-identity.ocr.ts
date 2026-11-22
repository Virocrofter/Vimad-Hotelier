/* C4′a — Digital-ID OCR. Tesseract reads the scan; a ZA ID's 13-digit number
 * is extracted and its first six digits (YYMMDD) yield the date of birth.
 * The scan artifact goes to storage (putFile); extraction results + the
 * POPIA retention expiry live in guest_id_scans (P28). */
import { createWorker } from 'tesseract.js';
import { prisma } from '../../common/prisma.js';
import { putFile } from '../../common/storage.js';

const ID_RE = /\b(\d{13})\b/;

/* The document STATES its date of birth — in the MRZ (line 2, chars
 * 14–19: YYMMDD + check digit) or as a printed date. NEVER derive DOB from
 * a document/serial number: only SA national IDs encode YYMMDD, and
 * passports are pure serials (C4′a review catch). */
function mrzDateOfBirth(text: string): string | null {
  // Position-independent: DOB(6) + check(1) + sex([FM]) + expiry(6) appear
  // adjacent in the MRZ even when OCR mangles the '<' fillers.
  const m = text.toUpperCase().match(/(\d{6})\s*\d\s*[FM]\s*\d{6}/);
  if (!m) return null;
  const dob = m[1];
  const yy = Number(dob.slice(0, 2));
  const mm = Number(dob.slice(2, 4));
  const dd = Number(dob.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function printedDateOfBirth(text: string): string | null {
  const m =
    text.match(/(?:date of birth|dob|born)[^\d]{0,12}(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/i) ??
    text.match(/(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ](\d{4})/);
  if (!m) return null;
  if (m[1].length === 4) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const months = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  const mi = months.indexOf(m[2].slice(0, 3).toLowerCase());
  return mi >= 0 ? `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

export interface IdScanResult {
  scanId: string;
  status: string;
  idNumber: string | null;
  dateOfBirth: string | null;
}

export async function scanId(
  tenantId: string,
  guestId: string,
  image: Buffer,
  retentionDays = 90
): Promise<IdScanResult> {
  const worker = await createWorker('eng');
  let text = '';
  try {
    const result = await worker.recognize(image as any);
    text = result.data.text ?? '';
  } finally {
    await worker.terminate();
  }

  const idNumber = text.match(ID_RE)?.[1] ?? null;
  const dateOfBirth = mrzDateOfBirth(text) ?? printedDateOfBirth(text);

  const key = `id-scans/${guestId}/${Date.now()}.png`;
  await putFile(key, image, 'image/png');
  const scan = await prisma.guestIdScan.create({
    data: {
      tenantId,
      guestId,
      key,
      extracted: { idNumber, dateOfBirth, raw: text.slice(0, 2000) },
      status: idNumber ? 'processed' : 'failed',
      expiresAt: new Date(Date.now() + retentionDays * 86400_000),
    },
  });

  if (idNumber) {
    await prisma.guest.updateMany({
      where: { id: guestId, tenantId },
      data: { passportNumber: idNumber },
    });
  }
  // DOB only from the document's own statement, and never overwrite an
  // existing value with OCR output (garbage-in protection).
  if (dateOfBirth) {
    await prisma.guest.updateMany({
      where: { id: guestId, tenantId, dateOfBirth: null },
      data: { dateOfBirth: new Date(dateOfBirth + 'T00:00:00Z') },
    });
  }
  return { scanId: scan.id, status: scan.status, idNumber, dateOfBirth };
}

/* POPIA retention: scans past their expiry are erased (rows now; storage
 * objects are purged by the storage sweeper). */
export async function sweepExpiredScans(tenantId?: string): Promise<number> {
  const res = await prisma.guestIdScan.deleteMany({
    where: { expiresAt: { lt: new Date() }, ...(tenantId ? { tenantId } : {}) },
  });
  return res.count;
}

export async function listScans(tenantId: string, guestId: string) {
  return prisma.guestIdScan.findMany({
    where: { tenantId, guestId },
    orderBy: { capturedAt: 'desc' },
    select: { id: true, status: true, extracted: true, capturedAt: true, expiresAt: true },
  });
}
