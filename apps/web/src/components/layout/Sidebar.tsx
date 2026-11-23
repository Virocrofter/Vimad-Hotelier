/* apps/web/src/components/layout/Sidebar.tsx
 * Rail-and-flyout chassis sidebar (blueprint S4, Phase 3).
 * 64px icon rail + 264px flyout panel. Hover previews a group, click pins
 * it, state persists in localStorage. Chain group stays context-gated.
 * The filter input is gone — the command palette (Cmd-K) is search.
 * Permissions: nav is discoverability, not a security boundary (server
 * authorization unchanged); role-based projection lands with the useAuth
 * census (P3.2b). Ribbon collapse <1200px + phone sheet land in P3.2b with
 * the layout pass.
 */
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getScope } from '../../api/chains';
import { useAuth } from '../../hooks/useAuth';
import { NAV_GROUPS } from '../../lib/navGroups';
import { cn } from '../../lib/utils';

const UI_KEY = 'nav.chassis.v1';

type UiState = { open: boolean; group: string };

function loadUi(): UiState {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? '{}');
    return { open: raw.open !== false, group: raw.group ?? 'command' };
  } catch {
    return { open: true, group: 'command' };
  }
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { pathname } = useLocation();
  const [ui, setUi] = useState<UiState>(loadUi);
  const auth = useAuth();
  const role = auth?.user?.role;
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/');

  const scopeQ = useQuery({ queryKey: ['nav-scope'], queryFn: getScope, staleTime: 60000 });
  const hasChain = (scopeQ.data?.properties?.length ?? 0) > 1;

  const groups = useMemo(
    () =>
      NAV_GROUPS.filter(
        (g) => (g.context !== 'chain' || hasChain) && (!g.roles || !role || g.roles.includes(role))
      ),
    [hasChain, role]
  );

  const activeKey = useMemo(() => {
    for (const g of groups) if (g.items.some((i) => isActive(i.to))) return g.key;
    return ui.group;
  }, [groups, ui.group, isActive]);

  const openKey = hoverGroup ?? activeKey;
  const open = ui.open || hoverGroup !== null;
  const openGroup = groups.find((g) => g.key === openKey) ?? groups[0];

  const persist = (patch: Partial<UiState>) =>
    setUi((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(UI_KEY, JSON.stringify(next));
      } catch {
        /* persistence best-effort */
      }
      return next;
    });

  return (
    <div className="flex h-full" onMouseLeave={() => setHoverGroup(null)}>
      <nav
        aria-label="Primary"
        className="flex h-full w-16 flex-col items-center gap-1 border-r py-3"
        style={{ borderColor: 'var(--hq-hairline)', background: 'var(--hq-surface-1)' }}
      >
        <Link
          to="/app/dashboard"
          aria-label="Command Center"
          onClick={onNavigate}
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: 'var(--hq-accent-soft)' }}
        >
          <span className="h-3 w-3 rounded-full" style={{ background: 'var(--primary)' }} />
        </Link>
        {groups.map((g) => {
          const Icon = g.icon;
          const active = g.key === activeKey;
          return (
            <button
              key={g.key}
              type="button"
              title={g.label}
              aria-label={g.label}
              aria-current={active ? 'true' : undefined}
              onClick={() => persist({ group: g.key, open: true })}
              onMouseEnter={() => setHoverGroup(g.key)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
              style={active ? { background: 'var(--hq-accent-soft)' } : undefined}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </nav>

      {open && openGroup && (
        <div
          className="flex h-full w-[264px] flex-col border-r"
          style={{ borderColor: 'var(--hq-hairline)', background: 'var(--hq-surface-1)' }}
          onMouseEnter={() => setHoverGroup(openGroup.key)}
        >
          <header className="flex items-center justify-between px-4 pb-2 pt-4">
            <h2
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              {openGroup.label}
            </h2>
            <button
              type="button"
              aria-label="Hide panel"
              className="rounded px-1.5 text-xs"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => persist({ open: false })}
            >
              &larr;
            </button>
          </header>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
            {openGroup.items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    'block rounded-md px-3 py-2 text-[13px]',
                    isActive(item.to)
                      ? 'bg-[var(--hq-accent-soft)] font-medium text-[var(--accent-foreground)]'
                      : 'hover:bg-[var(--hq-surface-2)]'
                  )}
                  style={!isActive(item.to) ? { color: 'var(--text-secondary)' } : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
