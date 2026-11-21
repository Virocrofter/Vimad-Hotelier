/* src/app/app/audit-trail/page.jsx */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User,
  Eye,
  FileText,
  Lock,
  Unlock,
  Edit3,
  Trash2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Database,
  Server,
  CreditCard,
  Key,
  Settings,
  Users,
  BedDouble,
  DollarSign,
  RefreshCw,
  Printer,
  ArrowUpDown,
  MoreHorizontal,
  ClipboardList,
  Activity,
  Globe,
  Mail,
  Phone,
  MapPin,
  Ban,
  ExternalLink,
  History,
  FileSpreadsheet,
  Sparkles,
  TrendingUp,
  Moon,
  Wrench,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '../../../components/ui/input';
import { fetchTenantAuditLogs } from '../../../api/audit';

/* ─── Metadata ─── */
const categoryMeta = {
  reservations: {
    label: 'Reservations',
    icon: BedDouble,
    color: 'text-secondary',
    bg: 'bg-secondary/10',
  },
  billing: { label: 'Billing', icon: DollarSign, color: 'text-accent', bg: 'bg-accent/10' },
  housekeeping: { label: 'Housekeeping', icon: Sparkles, color: 'text-info', bg: 'bg-info/10' },
  rates: { label: 'Rates', icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/10' },
  guests: { label: 'Guests', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  admin: { label: 'Admin', icon: Shield, color: 'text-danger', bg: 'bg-danger/10' },
  system: { label: 'System', icon: Server, color: 'text-text-muted', bg: 'bg-surface-elevated' },
  reports: { label: 'Reports', icon: FileText, color: 'text-teal-500', bg: 'bg-teal-500/10' },
  groups: { label: 'Groups', icon: Users, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  inventory: {
    label: 'Inventory',
    icon: Database,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  security: { label: 'Security', icon: Lock, color: 'text-danger', bg: 'bg-danger/10' },
};

const severityMeta = {
  info: {
    label: 'Info',
    dot: 'bg-accent',
    class: 'bg-accent/10 text-[var(--accent-soft-fg)] border-accent/20',
    icon: Info,
  },
  warning: {
    label: 'Warning',
    dot: 'bg-warning',
    class: 'bg-warning/10 text-[var(--warning-soft-fg)] border-warning/20',
    icon: AlertTriangle,
  },
  danger: {
    label: 'Critical',
    dot: 'bg-danger',
    class: 'bg-danger/10 text-[var(--danger-soft-fg)] border-danger/20',
    icon: XCircle,
  },
};

const actionTypeMeta = {
  'reservation.modify': { label: 'Modified Reservation', icon: Edit3 },
  'reservation.cancel': { label: 'Cancelled Reservation', icon: Ban },
  'billing.payment.post': { label: 'Posted Payment', icon: CreditCard },
  'housekeeping.status.update': { label: 'Updated Room Status', icon: Sparkles },
  'room.ooo.set': { label: 'Set OOO Status', icon: Wrench },
  'rates.override': { label: 'Rate Override', icon: TrendingUp },
  'guest.checkin': { label: 'Guest Check-in', icon: CheckCircle2 },
  'user.permission.modify': { label: 'Permission Change', icon: Shield },
  'system.backup.complete': { label: 'Backup Complete', icon: Database },
  'reports.export': { label: 'Report Export', icon: FileText },
  'nightaudit.run': { label: 'Night Audit', icon: Moon },
  'group.block.create': { label: 'Group Block Created', icon: Users },
  'inventory.adjust': { label: 'Inventory Adjusted', icon: Database },
  'channel.sync.error': { label: 'Sync Error', icon: RefreshCw },
  'security.login.failed': { label: 'Login Failed', icon: Lock },
};

/* ─── Helpers ─── */
function formatTimestamp(ts) {
  const date = new Date(ts.replace(' ', 'T'));
  const now = new Date();
  const diff = Math.floor((now - date) / 1000 / 60);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff} min ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Components ─── */
function StatCard({ label, value, subtext, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold font-mono', color)}>{value}</p>
          {subtext && <p className="mt-0.5 text-xs text-text-muted">{subtext}</p>}
        </div>
        <div
          className={cn(
            'rounded-lg p-2.5',
            color
              .replace('text-', 'bg-')
              .replace('danger', 'danger/10')
              .replace('accent', 'accent/10')
              .replace('warning', 'warning/10')
              .replace('info', 'info/10')
              .replace('secondary', 'secondary/10')
          )}
        >
          <Icon className={cn('h-5 w-5', color)} />
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const meta = severityMeta[severity] || severityMeta.info;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        meta.class
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function CategoryBadge({ category }) {
  const meta = categoryMeta[category] || categoryMeta.system;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        meta.bg,
        meta.color,
        'border-current/20'
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

/* ─── Detail Drawer ─── */
function AuditDetailDrawer({ entry, onClose }) {
  if (!entry) return null;
  const meta = actionTypeMeta[entry.action] || { label: entry.action, icon: Activity };
  const ActionIcon = meta.icon;
  const sevMeta = severityMeta[entry.severity];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-background shadow-2xl overflow-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-md px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn('flex h-10 w-10 items-center justify-center rounded-lg', sevMeta.bg)}
              >
                <ActionIcon className={cn('h-5 w-5', sevMeta.class.split(' ')[1])} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">{meta.label}</h2>
                <p className="text-xs text-text-muted">{entry.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 hover:bg-surface-elevated text-text-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Severity & Category */}
          <div className="flex items-center gap-2">
            <SeverityBadge severity={entry.severity} />
            <CategoryBadge category={entry.category} />
          </div>

          {/* Timestamp */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Event Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-text-secondary">
                <Clock className="h-4 w-4 text-text-muted" />
                <span>{entry.timestamp}</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <History className="h-4 w-4 text-text-muted" />
                <span className="font-mono text-xs">{entry.sessionId}</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <Globe className="h-4 w-4 text-text-muted" />
                <span className="font-mono text-xs">{entry.user.ip}</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary col-span-2">
                <ExternalLink className="h-4 w-4 text-text-muted" />
                <span className="text-xs truncate">{entry.userAgent}</span>
              </div>
            </div>
          </div>

          {/* User */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Actor
            </h4>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-sm font-bold text-secondary">
                {entry.user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{entry.user.name}</p>
                <p className="text-xs text-text-muted">
                  {entry.user.role} · ID: {entry.user.id}
                </p>
              </div>
            </div>
          </div>

          {/* Resource */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Target Resource
            </h4>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10">
                <Database className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{entry.resource.name}</p>
                <p className="text-xs text-text-muted">
                  {entry.resource.type} · {entry.resource.id}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Description
            </h4>
            <p className="text-sm text-text-secondary">{entry.description}</p>
          </div>

          {/* Changes */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Field Changes
            </h4>
            <div className="space-y-2">
              {entry.changes.map((change, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    {change.field}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-md bg-danger/5 border border-danger/20 px-3 py-2">
                      <p className="text-[10px] text-danger uppercase tracking-wider">Before</p>
                      <p className="text-sm font-mono text-text-primary">{change.old}</p>
                    </div>
                    <ArrowUpDown className="h-4 w-4 text-text-muted shrink-0" />
                    <div className="flex-1 rounded-md bg-accent/5 border border-accent/20 px-3 py-2">
                      <p className="text-[10px] text-accent uppercase tracking-wider">After</p>
                      <p className="text-sm font-mono text-text-primary">{change.new}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1">
              <Printer className="mr-1.5 h-4 w-4" /> Print Entry
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AuditTrailPage() {
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState('');

  // #75: real audit feed — this page previously rendered a hardcoded mock
  // array, showing invented compliance events to anyone who opened it.
  useEffect(() => {
    let cancelled = false;
    fetchTenantAuditLogs({ pageSize: 200 })
      .then((res) => {
        if (cancelled) return;
        const rows = (res?.data ?? []).map((e) => ({
          ...e,
          id: e.id ?? `${e.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp:
            typeof e.timestamp === 'string' ? e.timestamp.replace('T', ' ').slice(0, 19) : '',
          severity:
            e.severity === 'critical' || e.severity === 'high'
              ? 'danger'
              : e.severity === 'medium'
                ? 'warning'
                : 'info',
          action: e.action?.type ?? e.action ?? '',
          user: {
            id: e.user?.id ?? e.user?.name ?? '?',
            name: e.user?.name ?? 'Unknown',
            role: e.user?.role ?? '—',
            ip: e.user?.ip ?? '—',
          },
          resource: e.resource ?? { type: '', id: '', name: '' },
          changes: Array.isArray(e.changes) ? e.changes : [],
          description: e.description ?? e.action?.description ?? '',
          sessionId: e.sessionId ?? '—',
          userAgent: e.userAgent ?? '',
        }));
        setEntries(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setEntriesError(err?.message ?? 'Failed to load audit events');
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingEntries(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', dir: 'desc' });
  const [expandedRows, setExpandedRows] = useState(new Set());

  /* ─── Computed Data ─── */
  const matchesDateRange = (e) => {
    if (dateRange === 'all' || !e.timestamp) return true;
    const d = new Date(e.timestamp.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return true;
    const now = new Date();
    const dayMs = 86400000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateRange === 'today') return d >= startOfToday;
    if (dateRange === 'yesterday')
      return d >= new Date(startOfToday.getTime() - dayMs) && d < startOfToday;
    if (dateRange === 'week') return d >= new Date(startOfToday.getTime() - 6 * dayMs);
    if (dateRange === 'month') return d >= new Date(startOfToday.getTime() - 29 * dayMs);
    return true; // custom: no range pickers yet — show all
  };
  const filteredEntries = useMemo(() => {
    let result = entries.filter((e) => {
      const matchesQuery =
        !query ||
        e.id.toLowerCase().includes(query.toLowerCase()) ||
        e.user.name.toLowerCase().includes(query.toLowerCase()) ||
        e.resource.name.toLowerCase().includes(query.toLowerCase()) ||
        e.description.toLowerCase().includes(query.toLowerCase()) ||
        e.action.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchesSeverity = severityFilter === 'all' || e.severity === severityFilter;
      return matchesQuery && matchesCategory && matchesSeverity && matchesDateRange(e);
    });

    result.sort((a, b) => {
      if (sortConfig.key === 'timestamp') {
        return sortConfig.dir === 'asc'
          ? new Date(a.timestamp) - new Date(b.timestamp)
          : new Date(b.timestamp) - new Date(a.timestamp);
      }
      return 0;
    });

    return result;
  }, [entries, query, categoryFilter, severityFilter, sortConfig, dateRange]);

  const stats = useMemo(
    () => ({
      total: entries.length,
      info: entries.filter((e) => e.severity === 'info').length,
      warning: entries.filter((e) => e.severity === 'warning').length,
      danger: entries.filter((e) => e.severity === 'danger').length,
      uniqueUsers: new Set(entries.map((e) => e.user.id)).size,
    }),
    [entries]
  );

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Audit Trail</h1>
          <p className="text-sm text-text-secondary">
            Immutable activity log, compliance tracking, and change history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="mr-1.5 h-4 w-4" /> Print Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Events"
          value={stats.total}
          icon={ClipboardList}
          color="text-text-primary"
          subtext="Last 30 days"
        />
        <StatCard
          label="Info Events"
          value={stats.info}
          icon={Info}
          color="text-accent"
          subtext="Normal operations"
        />
        <StatCard
          label="Warnings"
          value={stats.warning}
          icon={AlertTriangle}
          color="text-warning"
          subtext="Requires review"
        />
        <StatCard
          label="Critical"
          value={stats.danger}
          icon={Shield}
          color="text-danger"
          subtext="Immediate attention"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by ID, user, resource, action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors',
              showFilters
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-border bg-surface text-text-secondary hover:bg-surface-elevated'
            )}
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Categories</option>
                {Object.entries(categoryMeta).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="danger">Critical</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setSeverityFilter('all');
                  setQuery('');
                }}
                className="h-10 rounded-md border border-border bg-background px-4 text-sm font-medium text-text-secondary hover:bg-surface-elevated transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      <p className="text-sm text-text-muted">
        Showing <span className="font-medium text-text-primary">{filteredEntries.length}</span> of{' '}
        {entries.length} audit entries
      </p>

      {entriesError && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {entriesError}
        </div>
      )}

      {/* Audit Table */}
      {loadingEntries ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-text-muted">
          Loading audit events…
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-10"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEntries.map((entry) => {
                  const meta = actionTypeMeta[entry.action] || {
                    label: entry.action,
                    icon: Activity,
                  };
                  const ActionIcon = meta.icon;
                  const isExpanded = expandedRows.has(entry.id);

                  return (
                    <>
                      <tr
                        key={entry.id}
                        className="hover:bg-background/50 transition-colors group cursor-pointer"
                        onClick={() => toggleRow(entry.id)}
                      >
                        <td className="px-4 py-3">
                          <button className="text-text-muted hover:text-text-primary">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-text-secondary text-xs">
                            {formatTimestamp(entry.timestamp)}
                          </div>
                          <div className="text-[10px] text-text-muted font-mono">
                            {entry.timestamp.split(' ')[1]}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={entry.severity} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/10 text-[10px] font-bold text-secondary">
                              {entry.user.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-text-primary">
                                {entry.user.name}
                              </p>
                              <p className="text-[10px] text-text-muted">{entry.user.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ActionIcon className="h-4 w-4 text-text-muted" />
                            <span className="text-sm text-text-primary">{meta.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-text-primary">{entry.resource.name}</p>
                          <p className="text-[10px] text-text-muted font-mono">
                            {entry.resource.id}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <CategoryBadge category={entry.category} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntry(entry);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-background/50">
                            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                              <p className="text-sm text-text-secondary">{entry.description}</p>
                              <div className="space-y-2">
                                {entry.changes.map((change, i) => (
                                  <div key={i} className="flex items-center gap-3 text-xs">
                                    <span className="font-medium text-text-muted w-24">
                                      {change.field}
                                    </span>
                                    <span className="rounded bg-danger/5 border border-danger/20 px-2 py-0.5 font-mono text-danger">
                                      {change.old}
                                    </span>
                                    <ArrowUpDown className="h-3 w-3 text-text-muted" />
                                    <span className="rounded bg-accent/5 border border-accent/20 px-2 py-0.5 font-mono text-accent">
                                      {change.new}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 pt-2 border-t border-border text-[10px] text-text-muted">
                                <span className="font-mono">Session: {entry.sessionId}</span>
                                <span>IP: {entry.user.ip}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                      <ClipboardList className="mx-auto h-10 w-10 mb-3" />
                      <p>No audit entries match your filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compliance Footer */}
      <div className="rounded-lg border border-border bg-surface p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-text-primary">Compliance & Data Retention</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Audit logs are immutable and retained for 7 years per PCI DSS and GDPR requirements.
            Export functionality is available for compliance officers and authorized administrators.
            All access to this page is logged and monitored.
          </p>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedEntry && (
        <AuditDetailDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}
