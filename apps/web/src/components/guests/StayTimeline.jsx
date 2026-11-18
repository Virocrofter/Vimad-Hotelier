/* Stay timeline (blueprint S6 Guest Card anatomy): vertical history,
 * newest first. Status = dot color + text badge (color-never-alone, S3). */
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDate, formatCurrency } from '../../lib/guest-utils';

const STATUS_DOT = {
  checked_in: 'bg-accent',
  confirmed: 'bg-info',
  checked_out: 'bg-muted-foreground',
  cancelled: 'bg-danger',
  no_show: 'bg-danger',
};
const STATUS_VARIANT = {
  checked_in: 'accent',
  confirmed: 'info',
  checked_out: 'neutral',
  cancelled: 'danger',
  no_show: 'danger',
};

export function StayTimeline({ reservations = [], limit = 6 }) {
  if (!reservations.length) return null;
  const sorted = [...reservations]
    .sort((a, b) => new Date(b.arrivalDate) - new Date(a.arrivalDate))
    .slice(0, limit);
  return (
    <ol className="relative ml-2 space-y-4 border-l border-border pl-5">
      {sorted.map((res) => (
        <li key={res.id} className="relative">
          <span
            className={`absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full ${STATUS_DOT[res.status] ?? 'bg-muted-foreground'}`}
            aria-hidden="true"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-text-primary">
                  {formatDate(res.arrivalDate)} → {formatDate(res.departureDate)}
                  <span className="ml-1 text-xs text-text-muted">({res.nights}n)</span>
                </p>
                <Badge variant={STATUS_VARIANT[res.status] ?? 'neutral'}>
                  {res.status?.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                {res.property?.name ?? '—'}
                {res.stays?.length
                  ? ` · Room ${res.stays
                      .map((s) => s.room?.number)
                      .filter(Boolean)
                      .join(', ')}`
                  : ''}
                {' · '}
                {formatCurrency(Number(res.totalAmount ?? 0))}
              </p>
            </div>
            <Link
              to={`/app/reservations/${res.id}`}
              className="shrink-0 text-text-muted hover:text-text-primary"
              title="Open reservation"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
