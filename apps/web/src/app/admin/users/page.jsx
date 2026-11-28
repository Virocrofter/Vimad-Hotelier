/* src/app/admin/users/page.jsx
 * Admin Users — live control-plane directory (Phase 3b, 2026-11-28).
 * Backed by internal_admin_users via GET/POST /admin/internal-admins.
 * The FOUNDER row self-provisions on first admin request; TOTP enrolment
 * and SUPPORT_AGENT / ONBOARDING_LEAD / FINANCE_ADMIN invites land in the
 * next RBAC batch. */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import {
  listInternalAdmins,
  setInternalAdminActive,
  beginInternalTotp,
  confirmInternalTotp,
  disableInternalTotp,
} from '@/api/adminTenants';
import { useAuthStore } from '@/stores/authStores';

const ROLE_META = {
  FOUNDER: { label: 'Founder — Supreme Mode', cls: 'border-accent/30 bg-accent/10 text-accent' },
  SUPPORT_AGENT: { label: 'Support Agent', cls: 'border-info/30 bg-info/10 text-info' },
  ONBOARDING_LEAD: {
    label: 'Onboarding Lead',
    cls: 'border-warning/30 bg-warning/10 text-warning',
  },
  FINANCE_ADMIN: {
    label: 'Finance Admin',
    cls: 'border-border bg-surface-elevated text-text-secondary',
  },
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [totp, setTotp] = useState({
    step: 'idle',
    secret: '',
    url: '',
    code: '',
    busy: false,
    error: null,
  });
  const myEmail = useAuthStore((s) => s.user?.email);

  const notify = (msg, isErr) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listInternalAdmins();
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      setRows(list);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const toggle = async (row) => {
    if (row.role === 'FOUNDER' && row.isActive) {
      return notify('Deactivating the FOUNDER is blocked — promote another admin first.', true);
    }
    setBusy(true);
    try {
      await setInternalAdminActive(row.id, !row.isActive);
      await load();
      notify(row.isActive ? 'Access revoked' : 'Access restored');
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
            <Users className="h-6 w-6" /> Admin Users
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Control-plane identities — separate from hotel-staff accounts. The FOUNDER row
            self-provisions from PLATFORM_ADMIN_EMAILS on first use.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text-primary hover:bg-surface-elevated"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <ShieldCheck className="h-4 w-4" />
          Access model
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>
            Every /admin/* route resolves internal_admin_users first; the env allowlist stops
            granting once any row exists.
          </li>
          <li>
            Impersonation sessions require a ticket number, default READ_ONLY, and expire after 60
            minutes.
          </li>
          <li>
            TOTP enrolment for these identities ships in the next RBAC batch — until then protect
            the account password.
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <KeyRound className="h-4 w-4" />
          Two-factor authentication (this identity)
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          TOTP via any authenticator app. Once enrolled, every login asks for a code — the secret
          lives on the control-plane identity, separate from hotel-staff 2FA.
        </p>
        {totp.step === 'idle' && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setTotp({ ...totp, busy: true, error: null });
                try {
                  const r = await beginInternalTotp();
                  setTotp({
                    ...totp,
                    step: 'begin',
                    secret: r.secret,
                    url: r.otpauthUrl,
                    busy: false,
                  });
                } catch (e) {
                  setTotp({ ...totp, busy: false, error: e.message });
                }
              }}
              disabled={totp.busy}
              className="h-9 rounded-md border border-accent/30 px-3 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              Enrol 2FA
            </button>
            {rows?.some((r) => r.email === myEmail && r.totpEnabled) && (
              <button
                type="button"
                onClick={() => setTotp({ ...totp, step: 'disable', code: '', error: null })}
                className="h-9 rounded-md border border-danger/30 px-3 text-sm text-danger hover:bg-danger/10"
              >
                Disable
              </button>
            )}
          </div>
        )}
        {totp.step === 'begin' && (
          <div className="mt-3 space-y-2">
            <p className="font-mono text-xs break-all text-text-secondary">{totp.secret}</p>
            <p className="font-mono text-[10px] break-all text-text-muted">{totp.url}</p>
            <input
              value={totp.code}
              onChange={(e) => setTotp({ ...totp, code: e.target.value })}
              placeholder="6-digit code from authenticator"
              className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-text-primary"
            />
            {totp.error && <p className="text-xs text-danger">{totp.error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={totp.busy || totp.code.length !== 6}
                onClick={async () => {
                  setTotp({ ...totp, busy: true, error: null });
                  try {
                    await confirmInternalTotp(totp.code);
                    setTotp({
                      step: 'idle',
                      secret: '',
                      url: '',
                      code: '',
                      busy: false,
                      error: null,
                    });
                    notify('2FA enabled');
                    await load();
                  } catch (e) {
                    setTotp({ ...totp, busy: false, error: e.message });
                  }
                }}
                className="h-9 flex-1 rounded-md bg-accent text-sm font-medium text-white disabled:opacity-50"
              >
                {totp.busy ? 'Verifying…' : 'Confirm & enable'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setTotp({ step: 'idle', secret: '', url: '', code: '', busy: false, error: null })
                }
                className="h-9 rounded-md border border-border px-3 text-sm text-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {totp.step === 'disable' && (
          <div className="mt-3 space-y-2">
            <input
              value={totp.code}
              onChange={(e) => setTotp({ ...totp, code: e.target.value })}
              placeholder="Current 6-digit code to confirm"
              className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-text-primary"
            />
            {totp.error && <p className="text-xs text-danger">{totp.error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={totp.busy || totp.code.length !== 6}
                onClick={async () => {
                  setTotp({ ...totp, busy: true, error: null });
                  try {
                    await disableInternalTotp(totp.code);
                    setTotp({
                      step: 'idle',
                      secret: '',
                      url: '',
                      code: '',
                      busy: false,
                      error: null,
                    });
                    notify('2FA disabled');
                    await load();
                  } catch (e) {
                    setTotp({ ...totp, busy: false, error: e.message });
                  }
                }}
                className="h-9 flex-1 rounded-md border border-danger/30 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                Confirm disable
              </button>
              <button
                type="button"
                onClick={() =>
                  setTotp({ step: 'idle', secret: '', url: '', code: '', busy: false, error: null })
                }
                className="h-9 rounded-md border border-border px-3 text-sm text-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {error && <div className="p-6 text-sm text-danger">Could not load: {error}</div>}
        {!error && rows === null && <div className="p-6 text-sm text-text-muted">Loading…</div>}
        {!error && rows !== null && rows.length === 0 && (
          <div className="p-6 text-sm text-text-muted">
            No control-plane identities yet — load any /admin page to self-provision the FOUNDER
            row.
          </div>
        )}
        {!error && rows !== null && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-text-secondary">
                <th className="px-4 py-3 font-medium">Identity</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">2FA</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = ROLE_META[r.role] ?? ROLE_META.FINANCE_ADMIN;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{r.fullName || r.email}</p>
                      <p className="font-mono text-xs text-text-muted">{r.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex rounded-full border px-2 py-0.5 text-xs ' + meta.cls
                        }
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.totpEnabled ? 'TOTP on' : 'Not enrolled'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.provisionedFromEnv ? 'Self-provisioned (env)' : 'Manual'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex rounded-full border px-2 py-0.5 text-xs ' +
                          (r.isActive
                            ? 'border-accent/30 bg-accent/10 text-accent'
                            : 'border-danger/30 bg-danger/10 text-danger')
                        }
                      >
                        {r.isActive ? 'active' : 'revoked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggle(r)}
                        className={
                          'h-8 rounded-md border px-3 text-xs ' +
                          (r.isActive
                            ? 'border-danger/30 text-danger hover:bg-danger/10'
                            : 'border-accent/30 text-accent hover:bg-accent/10')
                        }
                      >
                        {r.isActive ? 'Revoke' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <KeyRound className="h-4 w-4 text-text-muted" />
        <span className="text-text-secondary">
          Hotel staff accounts are managed per tenant under{' '}
          <Link to="/app/users" className="text-danger hover:underline">
            App Users
          </Link>{' '}
          — not here.
        </span>
      </div>

      {toast && (
        <div
          className={
            'fixed bottom-4 right-4 rounded-lg border px-4 py-2 text-sm ' +
            (toast.isErr
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-accent/30 bg-accent/10 text-accent')
          }
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
