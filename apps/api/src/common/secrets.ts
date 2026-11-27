/* apps/api/src/common/secrets.ts — AES-256-GCM secretbox for tenant-held
 * credentials (per-tenant Paystack keys, D-1/F-A21). Key material comes from
 * DATA_ENCRYPTION_KEY; without it a fixed dev key is used and warned about —
 * production must set the env var. */
import crypto from 'node:crypto';
import { logger } from './logger.js';

const ALGO = 'aes-256-gcm';

let warnedDevKey = false;

function dataKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY ?? '';
  if (raw.length >= 16) return crypto.createHash('sha256').update(raw).digest();
  if (!warnedDevKey) {
    warnedDevKey = true;
    logger.warn('DATA_ENCRYPTION_KEY not set — using the built-in dev key. Set it in production.');
  }
  return crypto.createHash('sha256').update('vimad-dev-data-key').digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, dataKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, dataB] = payload.split('.');
  if (!ivB || !tagB || !dataB) throw new Error('malformed secret payload');
  const decipher = crypto.createDecipheriv(ALGO, dataKey(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString(
    'utf8'
  );
}
