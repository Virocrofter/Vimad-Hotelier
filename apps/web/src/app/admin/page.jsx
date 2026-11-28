/* src/app/admin/page.jsx
 * Tenants & Properties - control-plane directory.
 * Phase 1: real API only (GET /admin/tenants + GET /admin/kpis).
 * The data.js mock and zustand store were deleted 2026-11-28; lifecycle
 * controls (suspend/wipe) and the 7-tab workspace land with the tenant
 * workspace pillar on top of real endpoints - never re-add UI that
 * fabricates state locally. */
import { useMemo, useState } from 'react';
import { useApiFetch } from '@/hooks/useApiFetch';
import {
  listAdminTenants,
  getFleetOpsDaily,
  startImpersonation,
  enterImpersonationSession,
} from '@/api/adminTenants';
import { enterImpersonation } from '@/lib/impersonation';
import { fetchAdminKpis } from '@/api/dashboard';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import {
  Search,
  Building2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Users,
  TrendingUp,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { TenantStatusBadge, PlanBadge, StatCard, TenantAvatar } from './components';
import { formatCurrency } from './lib';

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export default function AdminTenantsPage() {
  const { data: tenants, loading, error, refetch } = useApiFetch(listAdminTenants, []);
  const { data: kpis } = useApiFetch(fetchAdminKpis, []);
  const { data: ops } = useApiFetch(getFleetOpsDaily, []);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [imp, setImp] = useState(null); // impersonation modal: {ticket, mode, busy, error}
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const rows = useMemo(() => tenants || [], [tenants]);

  const statusOptions = useMemo(
    () => ['all', ...new Set(rows.map((t) => t.status).filter(Boolean))],
    [rows]
  );
  const planOptions = useMemo(
    () => ['all', ...new Set(rows.map((t) => t.plan).filter(Boolean))],
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((t) => {
      const matchesQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        String(t.plan).toLowerCase().includes(q);
      return (
        matchesQ &&
        (statusFilter === 'all' || t.status === statusFilter) &&
        (planFilter === 'all' || t.plan === planFilter)
      );
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sort.key === 'name') cmp = a.name.localeCompare(b.name);
      if (sort.key === 'createdAt') cmp = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sort.key === 'rooms') cmp = (a.rooms ?? -1) - (b.rooms ?? -1);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, query, statusFilter, planFilter, sort]);

  const handleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const opsLatest = ops?.series?.length ? ops.series[ops.series.length - 1] : null;
  const movement = ops?.movement ?? null;
  const dunning = ops?.dunning ?? { overdueCents: 0, count: 0 };

  const kpiCards = [
    {
      label: 'MRR',
      value: opsLatest
        ? formatCurrency(opsLatest.mrrCents / 100)
        : kpis?.mrr?.value != null
          ? formatCurrency(kpis.mrr.value)
          : '—',
      icon: DollarSign,
      color: 'text-secondary',
      subtext: movement
        ? (movement.netCents >= 0 ? '+' : '-') +
          formatCurrency(Math.abs(movement.netCents) / 100) +
          ` net (${movement.newCount} new / ${movement.churnedCount} churned)`
        : 'From TenantOpsDaily',
    },
    {
      label: 'Active Hotels',
      value: opsLatest?.tenants ?? kpis?.totalTenants?.value ?? '—',
      icon: Building2,
      color: 'text-accent',
      subtext: opsLatest ? `${opsLatest.rooms} rooms · ${opsLatest.redTenants} red-flag` : 'Live',
    },
    {
      label: 'Dunning Overdue',
      value: formatCurrency(dunning.overdueCents / 100),
      icon: AlertTriangle,
      color: dunning.overdueCents > 0 ? 'text-warning' : 'text-accent',
      subtext: `${dunning.count} overdue invoice${dunning.count === 1 ? '' : 's'}`,
    },
    {
      label: 'Avg Health',
      value: opsLatest?.avgHealth ?? '—',
      icon: Activity,
      color:
        opsLatest?.avgHealth >= 75
          ? 'text-accent'
          : opsLatest?.avgHealth >= 50
            ? 'text-warning'
            : 'text-danger',
      subtext: 'fleet average (v2 score)',
    },
  ];

  const sortHeader = (key, label) => (
    <th
      onClick={() => handleSort(key)}
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary hover:text-text-primary"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === key &&
          (sort.dir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tenants & Properties</h1>
          <p className="text-sm text-text-secondary">
            Live directory - sourced from GET /admin/tenants
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpiCards.map((k) => (
          <StatCard key={k.label} {...k} />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, ID, or plan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s}
            </option>
          ))}
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {planOptions.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'All plans' : p}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-text-muted">
        Showing <span className="font-medium text-text-primary">{filtered.length}</span> of{' '}
        {rows.length} tenants
      </p>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {loading && (
          <div className="p-6">
            <LoadingSkeleton count={5} />
          </div>
        )}
        {error && (
          <div className="p-6">
            <ErrorState error={error} onRetry={refetch} />
          </div>
        )}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background">
                <tr>
                  {sortHeader('name', 'Tenant')}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Region
                  </th>
                  {sortHeader('rooms', 'Rooms')}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Properties
                  </th>
                  {sortHeader('createdAt', 'Created')}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="cursor-pointer transition-colors hover:bg-background/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TenantAvatar name={t.name} size="sm" />
                        <div>
                          <p className="font-medium text-text-primary">{t.name}</p>
                          <p className="font-mono text-[10px] text-text-muted">{t.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TenantStatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={t.plan} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{t.region || '—'}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{t.rooms ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{t.properties ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                      <Building2 className="mx-auto mb-3 h-10 w-10" />
                      <p>No tenants match.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-md overflow-auto bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <TenantAvatar name={selected.name} size="lg" />
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{selected.name}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-text-muted">{selected.id}</span>
                    <TenantStatusBadge status={selected.status} />
                    <PlanBadge plan={selected.plan} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-elevated"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {[
                ['Region', selected.region || '—'],
                ['Rooms', selected.rooms ?? '—'],
                ['Properties', selected.properties ?? '—'],
                ['Created', fmtDate(selected.createdAt)],
                ['Last active', fmtDate(selected.lastActiveAt)],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-border pb-3 text-sm"
                >
                  <span className="text-text-secondary">{k}</span>
                  <span className="font-mono text-text-primary">{v}</span>
                </div>
              ))}
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-text-muted">
                <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <button
                  type="button"
                  onClick={() =>
                    setImp({ ticket: '', mode: 'READ_ONLY', busy: false, error: null })
                  }
                  className="h-9 w-full rounded-md border border-accent/30 text-sm text-accent hover:bg-accent/10"
                >
                  Impersonate (ticket required)
                </button>
                {imp && (
                  <div className="space-y-2 rounded-lg border border-accent/30 bg-surface p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                      Impersonate {selected.name}
                    </p>
                    <input
                      value={imp.ticket}
                      onChange={(e) => setImp({ ...imp, ticket: e.target.value })}
                      placeholder="Support ticket #"
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-text-primary"
                    />
                    <select
                      value={imp.mode}
                      onChange={(e) => setImp({ ...imp, mode: e.target.value })}
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-text-primary"
                    >
                      <option value="READ_ONLY">Read-only</option>
                      <option value="FULL_WRITE">Full write</option>
                    </select>
                    {imp.error && <p className="text-xs text-danger">{imp.error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={imp.busy || imp.ticket.trim().length < 3}
                        onClick={async () => {
                          setImp({ ...imp, busy: true, error: null });
                          try {
                            const session = await startImpersonation(
                              selected.id,
                              imp.mode,
                              imp.ticket.trim()
                            );
                            const entered = await enterImpersonationSession(session.id);
                            await enterImpersonation({
                              token: entered.token,
                              sessionId: session.id,
                              tenantId: selected.id,
                              tenantName: selected.name,
                              mode: session.mode,
                              ticket: session.ticket,
                              expiresAt: session.expiresAt,
                            });
                          } catch (e) {
                            setImp({ ...imp, busy: false, error: e.message });
                          }
                        }}
                        className="h-9 flex-1 rounded-md bg-accent text-sm font-medium text-white disabled:opacity-50"
                      >
                        {imp.busy ? 'Starting…' : 'Start 60-min session'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setImp(null)}
                        className="h-9 rounded-md border border-border px-3 text-sm text-text-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                The 7-tab tenant workspace (billing, usage, staff, audit, lifecycle controls) ships
                with the Tenants pillar on real endpoints - controls here never mutate local state.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
