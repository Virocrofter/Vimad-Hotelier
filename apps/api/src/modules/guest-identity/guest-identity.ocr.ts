/* C4′a — Digital-ID OCR. Tesseract reads the scan; a ZA ID's 13-digit number
 * is extracted and its first six digits (YYMMDD) yield the date of birth.
 * The scan artifact goes to storage (putFile); extraction results + the
 * POPIA retention expiry live in guest_id_scans (P28). */
import { createWorker } from 'tesseract.js';
import { prisma } from '../../common/prisma.js';
import { putFile } from '../../common/storage.js';

const ID_RE = /\b(\d{13})\b/;

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
  let dateOfBirth: string | null = null;
  if (idNumber) {
    const yy = Number(idNumber.slice(0, 2));
    const mm = Number(idNumber.slice(2, 4));
    const dd = Number(idNumber.slice(4, 6));
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const year = yy <= 30 ? 2000 + yy : 1900 + yy;
      dateOfBirth = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

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
      data: {
        passportNumber: idNumber,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth + 'T00:00:00Z') } : {}),
      },
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
