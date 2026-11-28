/* apps/api/src/modules/auth/auth.service.ts */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, createHmac, randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { env } from '../../common/env.js';
import { sendPasswordResetEmail } from '../../jobs/email.queue.js';

const JWT_EXPIRES_IN = '15m' as const;

const JWT_SECRET = env.JWT_SECRET;

/* ─── Token hashing for DB storage ─── */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const registerSchema = z.object({
  tenantName: z.string().min(1),
  tenantSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerFirstName: z.string().optional(),
  ownerLastName: z.string().optional(),
});

export const loginSchema = z.object({
  // Optional for internal admins (email is the identity; tenant resolved
  // from the users table). Required in practice for hotel staff.
  tenantSlug: z.string().max(200).optional(), // '' = admin slug-less sign-in
  email: z.string().email(),
  password: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().min(1),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/* ─── REGISTER: Auto-create RoleAssignment for Owner role ─── */
export async function register(input: RegisterInput) {
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
  });
  if (existingTenant) {
    throw new AppError(409, 'Tenant slug already exists', 'CONFLICT');
  }

  const hashedPassword = await bcrypt.hash(input.ownerPassword, 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: input.tenantName,
      slug: input.tenantSlug,
      users: {
        create: {
          email: input.ownerEmail,
          passwordHash: hashedPassword,
          firstName: input.ownerFirstName,
          lastName: input.ownerLastName,
          role: 'owner',
          status: 'active',
        },
      },
    },
    include: { users: true },
  });

  const owner = tenant.users[0];

  const ownerRole = await prisma.role.findFirst({
    where: { name: 'Owner', tenantId: null },
  });

  if (ownerRole) {
    await prisma.roleAssignment.create({
      data: {
        userId: owner.id,
        roleId: ownerRole.id,
        assignedBy: owner.id,
      },
    });
  }

  const token = signToken({
    userId: owner.id,
    tenantId: tenant.id,
    email: owner.email,
    role: owner.role,
  });
  const refreshToken = await generateRefreshToken(owner.id);

  return {
    token,
    refreshToken,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    user: {
      id: owner.id,
      email: owner.email,
      firstName: owner.firstName,
      lastName: owner.lastName,
      role: owner.role,
    },
  };
}

// Phase 1 (2026-11-28): login telemetry feeding the tenant health-score
// logins pillar. Fire-and-forget — a failed insert must never block login.
async function recordAuthEvent(tenantId: string, userId: string, kind: string) {
  try {
    await prisma.$executeRawUnsafe(
      'INSERT INTO auth_events (id, "tenantId", "userId", kind, "at") VALUES (gen_random_uuid()::text, $1, $2, $3, now())',
      tenantId,
      userId,
      kind
    );
  } catch {
    /* telemetry only */
  }
}

export async function login(input: LoginInput) {
  let tenantSlug = input.tenantSlug ?? '';

  // Phase 3b: internal admins sign in WITHOUT a hotel slug — the email is
  // the identity; the account's own tenant is resolved from the users table.
  // Hotel staff still sign in with their tenant slug (unchanged).
  if (!tenantSlug) {
    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.includes(input.email.trim().toLowerCase())) {
      const adminUser = await prisma.user.findFirst({
        where: { email: { equals: input.email.trim(), mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        include: { tenant: { select: { slug: true } } },
      });
      if (adminUser?.tenant?.slug) tenantSlug = adminUser.tenant.slug;
    }
    if (!tenantSlug) {
      throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) {
    throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
  });

  if (!user || user.status !== 'active') {
    throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash ?? '');
  if (!valid) {
    throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
  }

  // P67: enforced tenants — users without TOTP get a forced-setup pending
  // token (10m) instead of a session; setup/enable accept that token.
  const tenantEnforce = await prisma.tenant.findFirst({
    where: { id: user.tenantId },
    select: { require2fa: true },
  });
  if (tenantEnforce?.require2fa && !user.totpEnabled) {
    const setupToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, twoFactorSetup: true },
      JWT_SECRET,
      { expiresIn: '10m' }
    );
    return { twoFactorSetupRequired: true, pendingToken: setupToken };
  }

  // P46: 2FA-enabled users get a short-lived pending token instead of a
  // session; POST /auth/login/2fa completes the second factor.
  if (user.totpEnabled && user.totpSecret) {
    const pendingToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, twoFactorPending: true },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return { twoFactorRequired: true, pendingToken };
  }

  // Phase 3b: internal admins (control plane) carry their own TOTP secret on
  // internal_admin_users. Same pending-token flow; /auth/login/2fa verifies
  // against the internal secret when the token carries internalAdmin.
  const iaRows = (await prisma.$queryRawUnsafe(
    `SELECT "totpEnabled" FROM "internal_admin_users"
     WHERE lower(email) = lower($1) AND "isActive" AND "totpSecret" IS NOT NULL
     LIMIT 1`,
    input.email
  )) as any[];
  if (iaRows[0]?.totpEnabled) {
    const pendingToken = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        twoFactorPending: true,
        internalAdmin: true,
      },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return { twoFactorRequired: true, pendingToken };
  }

  await recordAuthEvent(user.tenantId, user.id, 'login');
  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  });
  const refreshToken = await generateRefreshToken(user.id);

  // Flag control-plane identities so the client can route them to /admin
  // after sign-in (hotels continue to /app).
  const iaCheck = (await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM "internal_admin_users" WHERE lower(email) = lower($1) AND "isActive" LIMIT 1`,
    user.email
  )) as any[];
  const isPlatformAdmin = iaCheck.length > 0;

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isPlatformAdmin,
    },
  };
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

/* ─── REFRESH TOKEN: DB-persisted with revocation support ─── */
export async function generateRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(raw);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return raw;
}

export async function refreshAccessToken(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  const stored = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!stored || !stored.user || stored.user.status !== 'active') {
    throw new AppError(401, 'Invalid or expired refresh token', 'UNAUTHORIZED');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), revokedReason: 'rotated' },
  });

  const token = signToken({
    userId: stored.user.id,
    tenantId: stored.user.tenantId,
    email: stored.user.email,
    role: stored.user.role,
  });

  const newRefreshToken = await generateRefreshToken(stored.user.id);

  return {
    token,
    refreshToken: newRefreshToken,
    user: {
      id: stored.user.id,
      email: stored.user.email,
      firstName: stored.user.firstName,
      lastName: stored.user.lastName,
      role: stored.user.role,
      tenantId: stored.user.tenantId,
    },
  };
}

export async function revokeRefreshToken(rawToken: string, reason?: string) {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date(), revokedReason: reason ?? 'manual_revocation' },
  });
}

export async function revokeAllUserRefreshTokens(userId: string, reason?: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason ?? 'password_change' },
  });
}

/* ─── PASSWORD RESET ─── */
export async function requestPasswordReset(email: string, tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return { sent: false };
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!user || user.status !== 'active') {
    return { sent: false };
  }

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // ─── WIRED: Send password reset email via queue ───
  await sendPasswordResetEmail(user.email, rawToken);

  return { sent: true };
}

export async function confirmPasswordReset(rawToken: string, newPassword: string) {
  const tokenHash = hashToken(rawToken);

  const reset = await prisma.passwordReset.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!reset) {
    throw new AppError(400, 'Invalid or expired reset token', 'RESET_TOKEN_INVALID');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hashedPassword },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: reset.userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'password_reset' },
    }),
  ]);

  return { success: true };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Current password is incorrect', 'UNAUTHORIZED');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'password_change' },
    }),
  ]);

  return { success: true };
}

/* ─── TOTP 2FA (P46) — RFC 6238, SHA-1 / 30s / 6 digits (Authenticator
 * standard). Hand-rolled on node:crypto — no new dependency. ─── */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.toUpperCase().replace(/=+$/, '')) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpCode(secretB32: string, counter?: number): string {
  const c = counter ?? Math.floor(Date.now() / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(c));
  const hmac = createHmac('sha1', base32Decode(secretB32)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secretB32: string, code: string, windowSteps = 1): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -windowSteps; w <= windowSteps; w++) {
    if (totpCode(secretB32, counter + w) === code) return true;
  }
  return false;
}

export async function setupTotp(userId: string) {
  const secret = base32Encode(randomBytes(20));
  await prisma.user.update({ where: { id: userId }, data: { totpPendingSecret: secret } });
  return {
    secret,
    otpauthUrl: `otpauth://totp/Vimad:${encodeURIComponent(userId)}?secret=${secret}&issuer=Vimad`,
  };
}

export async function enableTotp(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpPendingSecret) {
    throw new AppError(400, 'Run 2FA setup first', 'VALIDATION_ERROR');
  }
  if (!verifyTotp(user.totpPendingSecret, code)) {
    throw new AppError(400, 'Invalid code', 'INVALID_CODE');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: user.totpPendingSecret, totpEnabled: true, totpPendingSecret: null },
  });
  await revokeAllUserRefreshTokens(userId, '2fa_enabled');
  return { enabled: true };
}

export async function disableTotp(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpEnabled || !user.totpSecret) {
    throw new AppError(400, '2FA not enabled', 'VALIDATION_ERROR');
  }
  if (!verifyTotp(user.totpSecret, code)) {
    throw new AppError(400, 'Invalid code', 'INVALID_CODE');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false, totpPendingSecret: null },
  });
  await revokeAllUserRefreshTokens(userId, '2fa_disabled');
  return { enabled: false };
}

/* Complete the second factor: exchange the pending token + TOTP code for a
 * session. The code is the actual second factor; the pending token carries a
 * 5-minute window (reuse within it still requires a fresh valid code). */
export async function verifyTotpLogin(pendingToken: string, code: string) {
  let payload: { userId?: string; twoFactorPending?: boolean; internalAdmin?: boolean };
  try {
    payload = jwt.verify(pendingToken, JWT_SECRET) as {
      userId?: string;
      twoFactorPending?: boolean;
      internalAdmin?: boolean;
    };
  } catch {
    throw new AppError(401, 'Pending session expired — log in again', 'UNAUTHORIZED');
  }
  if (!payload.twoFactorPending || !payload.userId) {
    throw new AppError(401, 'Invalid pending session', 'UNAUTHORIZED');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status !== 'active') {
    throw new AppError(401, 'Invalid pending session', 'UNAUTHORIZED');
  }

  if (payload.internalAdmin) {
    // Phase 3b: the second factor for control-plane identities lives on
    // internal_admin_users — never on the app user row.
    const iaRows = (await prisma.$queryRawUnsafe(
      `SELECT "totpSecret" FROM "internal_admin_users"
       WHERE lower(email) = lower($1) AND "isActive" AND "totpEnabled"
       LIMIT 1`,
      user.email
    )) as any[];
    const secret = iaRows[0]?.totpSecret;
    if (!secret || !verifyTotp(secret, code)) {
      throw new AppError(401, 'Invalid code', 'INVALID_CODE');
    }
  } else {
    if (!user.totpEnabled || !user.totpSecret) {
      throw new AppError(401, 'Invalid pending session', 'UNAUTHORIZED');
    }
    if (!verifyTotp(user.totpSecret, code)) {
      throw new AppError(401, 'Invalid code', 'INVALID_CODE');
    }
  }
  await recordAuthEvent(user.tenantId, user.id, 'login');
  const token = signToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  });
  const refreshToken = await generateRefreshToken(user.id);

  // Flag control-plane identities so the client can route them to /admin
  // after sign-in (hotels continue to /app).
  const iaCheck = (await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM "internal_admin_users" WHERE lower(email) = lower($1) AND "isActive" LIMIT 1`,
    user.email
  )) as any[];
  const isPlatformAdmin = iaCheck.length > 0;

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isPlatformAdmin,
    },
  };
}

/* P67 — tenant-wide 2FA enforcement toggle (owner/admin). */
export async function set2faEnforcement(tenantId: string, require2fa: boolean) {
  await prisma.tenant.update({ where: { id: tenantId }, data: { require2fa } });
  return { require2fa };
}

export async function get2faEnforcement(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { require2fa: true },
  });
  return { require2fa: tenant?.require2fa ?? false };
}
