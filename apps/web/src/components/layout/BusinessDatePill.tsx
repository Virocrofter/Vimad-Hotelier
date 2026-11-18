/* apps/web/src/components/layout/BusinessDatePill.tsx
 * Business date pill (blueprint S4 topbar). V1 shows the operating date and
 * links to Night Audit; the audit-state dot + date jumper land with the
 * night-audit console migration (Phase 6) when business date becomes a
 * first-class store entity. */
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';

export function BusinessDatePill() {
  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return (
    <Link
      to="/app/night-audit"
      className="hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm lg:inline-flex"
      style={{
        borderColor: 'var(--hq-hairline)',
        background: 'var(--hq-surface-1)',
        color: 'var(--text-secondary)',
      }}
      title="Business date — open Night Audit"
    >
      <CalendarClock className="h-4 w-4" />
      <span className="font-medium">{today}</span>
    </Link>
  );
}
