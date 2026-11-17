/* Dock (plan section 1.2/2.2): compact icon rail - Home, permitted Offices,
 * Needs Attention with open-count, Setup at bottom, active pill, icon
 * collapse. Flag-gated (nav.dock); Sidebar preserved for rollback. */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  Settings,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useLiveFlag } from '../../components/FlagsProvider';
import { listExceptions } from '../../api/exceptions';
import { getScope } from '../../api/chains';

export default function Dock() {
  const [expanded, setExpanded] = useState(false);
  const hkOn = useLiveFlag('housekeeping.v2', false);
  const maintOn = useLiveFlag('offices.maintenance', false);
  const frontOn = useLiveFlag('offices.front', false);
  const scopeQ = useQuery({ queryKey: ['nav-scope'], queryFn: getScope, staleTime: 60000 });
  const hasChain = (scopeQ.data?.properties?.length ?? 0) > 1;
  const excQ = useQuery({
    queryKey: ['dock-exc'],
    queryFn: () => listExceptions('open'),
    staleTime: 30000,
  });
  const excPayload = excQ.data?.data ?? excQ.data ?? {};
  const openCount = excPayload.counts?.open ?? 0;

  const items = [
    { to: '/app/dashboard', label: 'Home', Icon: LayoutGrid, end: true },
    { to: '/app/exceptions', label: 'Needs Attention', Icon: AlertTriangle, badge: openCount },
    ...(frontOn ? [{ to: '/app/offices/front', label: 'Front Office', Icon: Sparkles }] : []),
    ...(hkOn ? [{ to: '/app/housekeeping', label: 'Housekeeping', Icon: BedDouble }] : []),
    ...(maintOn ? [{ to: '/app/offices/maintenance', label: 'Maintenance', Icon: Wrench }] : []),
    ...(hasChain ? [{ to: '/app/chain-billing', label: 'Chain Billing', Icon: Building2 }] : []),
  ];

  const itemCls = (isActive) =>
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ' +
    (isActive
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary');

  return (
    <nav
      aria-label="Dock"
      className={
        'flex h-full flex-col border-r border-border bg-surface py-3 transition-all ' +
        (expanded ? 'w-48' : 'w-16 items-center')
      }
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? 'Collapse dock' : 'Expand dock'}
        className="mx-2 mb-2 rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-secondary"
      >
        {expanded ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
      </button>
      <div className="flex-1 space-y-1 px-2">
        {items.map(({ to, label, Icon, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) => itemCls(isActive)}
          >
            <span className="relative">
              <Icon className="h-4 w-4" />
              {badge > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            {expanded && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </div>
      <div className="px-2">
        <NavLink to="/app/onboarding" title="Setup" className={({ isActive }) => itemCls(isActive)}>
          <Settings className="h-4 w-4" />
          {expanded && <span className="truncate">Setup</span>}
        </NavLink>
      </div>
    </nav>
  );
}
