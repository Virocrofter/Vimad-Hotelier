/* apps/web/src/lib/impersonation.tsx
 * Impersonation bridge (Phase 3b, 2026-11-28). Swaps the founder's session
 * for a tenant-scoped impersonation JWT, stashes the real tokens, and shows
 * a crimson banner for the session's life (blueprint: impersonation must
 * NEVER be hidden). Exit restores the founder's session. Never stealth:
 * the banner renders on every route while a session is active. */
import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getAccessToken, getRefreshToken, setTokens, useAuthStore } from '../stores/authStores';
import { usePropertyStore } from '../stores/propertyStore';

const KEY = 'vimad_impersonation';
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function isImpersonating(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function getImpersonation(): any | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function enterImpersonation(opts: {
  token: string;
  sessionId: string;
  tenantId: string;
  tenantName: string;
  mode: string;
  ticket: string;
  expiresAt: string;
}): Promise<void> {
  const stashedAccess = getAccessToken();
  const stashedRefresh = getRefreshToken();
  localStorage.setItem(KEY, JSON.stringify({ ...opts, stashedAccess, stashedRefresh }));
  usePropertyStore.getState().clear();
  setTokens(opts.token, '');
  useAuthStore.setState({
    token: opts.token,
    refreshToken: '',
    user: jwtDecode(opts.token),
    isAuthenticated: true,
  });
  window.location.href = '/app';
}

/* Best-effort: end the server session, restore stashed tokens, clear the
 * property scope. Safe to call when nothing is stashed. */
export async function exitImpersonationAndRestore(): Promise<void> {
  const s = getImpersonation();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (s?.sessionId && s?.stashedAccess) {
    try {
      await fetch(`${API_BASE}/admin/impersonation/${encodeURIComponent(s.sessionId)}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.stashedAccess}` },
      });
    } catch {
      /* best-effort */
    }
  }
  if (s?.stashedAccess) {
    setTokens(s.stashedAccess, s.stashedRefresh ?? '');
    useAuthStore.setState({
      token: s.stashedAccess,
      refreshToken: s.stashedRefresh ?? '',
      user: jwtDecode(s.stashedAccess),
      isAuthenticated: true,
    });
    usePropertyStore.getState().clear();
  }
}

export function ImpersonationBanner() {
  const [imp, setImp] = useState<any | null>(null);
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const s = getImpersonation();
      setImp(s);
      if (s?.expiresAt) {
        const ms = new Date(s.expiresAt).getTime() - Date.now();
        if (ms <= 0) {
          void exitImpersonationAndRestore().then(() => {
            if (window.location.pathname.startsWith('/app')) window.location.href = '/admin';
          });
          return;
        }
        const m = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        setRemaining(`${m}:${String(sec).padStart(2, '0')}`);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (!imp) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex items-center justify-center gap-4 border-t border-danger/40 bg-danger px-4 py-2 text-sm font-medium text-white shadow-2xl">
      <span>
        IMPERSONATING {imp.tenantName} · {imp.mode} · ticket {imp.ticket} · {remaining} left
      </span>
      <button
        type="button"
        onClick={() =>
          void exitImpersonationAndRestore().then(() => {
            window.location.href = '/admin';
          })
        }
        className="h-8 rounded-md bg-white px-3 text-xs font-bold uppercase tracking-wide text-danger hover:bg-white/90"
      >
        Exit to admin
      </button>
    </div>
  );
}
