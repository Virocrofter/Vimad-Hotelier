/* ReceiptCard (blueprint S6): dotted-leader rows, big total, status chip.
 * Summary-first folio receipt — line items render when present. */
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '../../lib/money';

const fmt = (n, currency = 'ZAR') => formatMoney(Number(n) || 0, currency);

function Row({ label, amount, currency, tone }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="flex-1 -translate-y-1 border-b border-dotted border-border" />
      <span className={`font-mono tabular-nums ${tone ?? 'text-text-primary'}`}>
        {fmt(amount, currency)}
      </span>
    </div>
  );
}

export function ReceiptCard({ folio, currency = 'ZAR' }) {
  const balance = Number(folio.balance) || 0;
  const status = balance > 0 ? 'balance due' : folio.status === 'closed' ? 'settled' : 'open';
  const items = folio.items ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-text-muted">
            {folio.reservation?.confirmationNumber || folio.reservationId}
          </p>
          <p className="text-base font-semibold text-text-primary">
            {folio.reservation?.guest
              ? `${folio.reservation.guest.firstName} ${folio.reservation.guest.lastName}`
              : 'Guest'}
          </p>
        </div>
        <Badge
          className={balance > 0 ? 'bg-warning/25 text-warning' : 'bg-success/15 text-success'}
        >
          {status}
        </Badge>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 border-b border-dotted border-border pb-3">
          {items.map((it, i) => (
            <Row
              key={it.id ?? i}
              label={it.description ?? it.type ?? 'Item'}
              amount={it.amount}
              currency={currency}
            />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Row label="Charges" amount={folio.totalCharges} currency={currency} />
        <Row label="Payments" amount={folio.totalPayments} currency={currency} tone="text-accent" />
      </div>

      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Balance due
        </span>
        <span
          className={`text-3xl font-bold tabular-nums ${
            balance > 0 ? 'hq-revenue' : 'text-text-primary'
          }`}
        >
          {fmt(balance, currency)}
        </span>
      </div>

      {folio.reservation?.id && (
        <Link
          to={`/app/reservations/${folio.reservation.id}`}
          className="flex items-center gap-1.5 text-xs text-secondary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open reservation
        </Link>
      )}
    </div>
  );
}
