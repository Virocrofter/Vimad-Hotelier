/* src/app/admin/lib.js
 * Shared presentation helpers for the admin control plane.
 * Extracted from the deleted data.js mock - meta and formatting only,
 * NO fabricated tenant data lives here anymore. */
export const statusMeta = {
  active: { label: 'Active', class: 'border-accent/30 bg-accent/10 text-accent', dot: 'bg-accent' },
  trial: { label: 'Trial', class: 'border-info/30 bg-info/10 text-info', dot: 'bg-info' },
  suspended: {
    label: 'Suspended',
    class: 'border-warning/30 bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  past_due: {
    label: 'Past Due',
    class: 'border-warning/30 bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  cancelled: {
    label: 'Cancelled',
    class: 'border-danger/30 bg-danger/10 text-danger',
    dot: 'bg-danger',
  },
  pending: {
    label: 'Pending',
    class: 'border-border bg-surface-elevated text-text-secondary',
    dot: 'bg-text-muted',
  },
  unknown: {
    label: 'Unknown',
    class: 'border-border bg-surface-elevated text-text-secondary',
    dot: 'bg-text-muted',
  },
};

export const billingStatusMeta = {
  paid: { label: 'Paid', class: 'border-accent/30 bg-accent/10 text-accent', dot: 'bg-accent' },
  trial: { label: 'Trial', class: 'border-info/30 bg-info/10 text-info', dot: 'bg-info' },
  overdue: {
    label: 'Overdue',
    class: 'border-danger/30 bg-danger/10 text-danger',
    dot: 'bg-danger',
  },
  pending: {
    label: 'Pending',
    class: 'border-border bg-surface-elevated text-text-secondary',
    dot: 'bg-text-muted',
  },
  cancelled: {
    label: 'Cancelled',
    class: 'border-danger/30 bg-danger/10 text-danger',
    dot: 'bg-danger',
  },
  unknown: {
    label: 'Unknown',
    class: 'border-border bg-surface-elevated text-text-secondary',
    dot: 'bg-text-muted',
  },
};

export const planMeta = {
  Starter: { label: 'Starter', bg: 'bg-text-muted/10', color: 'text-text-secondary' },
  Professional: { label: 'Professional', bg: 'bg-info/10', color: 'text-info' },
  Enterprise: { label: 'Enterprise', bg: 'bg-accent/10', color: 'text-accent' },
  Compass: { label: 'Compass', bg: 'bg-info/10', color: 'text-info' },
  Command: { label: 'Command', bg: 'bg-accent/10', color: 'text-accent' },
  Constellation: { label: 'Constellation', bg: 'bg-secondary/10', color: 'text-secondary' },
  Armada: { label: 'Armada', bg: 'bg-warning/10', color: 'text-warning' },
};

export function getUsagePercent(used, total) {
  if (typeof total === 'string' || !total || total <= 0 || used == null) return null;
  return Math.min(100, Math.round((used / total) * 100));
}

export function getUsageColor(pct) {
  if (pct === null) return 'text-text-muted';
  if (pct >= 100) return 'text-danger';
  if (pct >= 90) return 'text-warning';
  if (pct >= 75) return 'text-info';
  return 'text-accent';
}

export function getUsageBarColor(pct) {
  if (pct === null) return 'bg-text-muted';
  if (pct >= 100) return 'bg-danger';
  if (pct >= 90) return 'bg-warning';
  if (pct >= 75) return 'bg-info';
  return 'bg-accent';
}

export function formatCurrency(n) {
  if (n == null || Number.isNaN(Number(n))) return 'R —';
  return (
    'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
