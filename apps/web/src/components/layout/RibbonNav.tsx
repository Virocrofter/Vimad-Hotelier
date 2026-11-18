/* apps/web/src/components/layout/RibbonNav.tsx
 * Horizontal pill ribbon (blueprint S4) for viewports <1200px: groups
 * flatten into one scrollable strip. Role-projected like the rail. The
 * phone bottom-sheet refinement rides a later pass.
 */
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getScope } from '../../api/chains';
import { NAV_GROUPS } from '../../lib/navGroups';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

export default function RibbonNav() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const role = auth?.user?.role;
  const scopeQ = useQuery({ queryKey: ['nav-scope'], queryFn: getScope, staleTime: 60000 });
  const hasChain = (scopeQ.data?.properties?.length ?? 0) > 1;

  const groups = NAV_GROUPS.filter(
    (g) => (g.context !== 'chain' || hasChain) && (!g.roles || !role || g.roles.includes(role))
  );

  return (
    <nav
      aria-label="Primary (ribbon)"
      className="flex gap-1.5 overflow-x-auto border-b px-3 py-2"
      style={{ borderColor: 'var(--hq-hairline)', background: 'var(--hq-surface-1)' }}
    >
      {groups.flatMap((g) =>
        g.items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + '/');
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1 text-[13px]',
                active
                  ? 'bg-[var(--hq-accent-soft)] font-medium text-[var(--primary)]'
                  : 'text-[var(--text-secondary)]'
              )}
              style={
                !active ? { borderColor: 'var(--hq-hairline)' } : { borderColor: 'transparent' }
              }
            >
              {item.label}
            </Link>
          );
        })
      )}
    </nav>
  );
}
