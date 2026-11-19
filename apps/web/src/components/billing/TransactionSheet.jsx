/* TransactionSheet (blueprint S6): the receipt for one payment — signed
 * amount, status pill, method, reservation link. */
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatMoneyMinor } from '../../lib/money';

const CHIP = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  refunded: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  partially_refunded: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const fmt = (minor, currency = 'ZAR') => formatMoneyMinor(minor, currency);

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

export function TransactionSheet({ payment: p }) {
  const net = (p.amountMinor ?? 0) - (p.refundedMinor ?? 0);
  const isRefund = p.type === 'refund' || (p.refundedMinor ?? 0) >= (p.amountMinor ?? 1);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-text-muted">{p.reference}</p>
          <p className="text-base font-semibold text-text-primary">
            {p.guest ? `${p.guest.firstName} ${p.guest.lastName}` : 'Guest'}
            {p.cardLast4 && (
              <span className="ml-2 text-xs font-normal text-text-muted">
                {p.cardBrand ? p.cardBrand + ' ' : ''}•••• {p.cardLast4}
                {p.bank ? ` · ${p.bank}` : ''}
              </span>
            )}
          </p>
        </div>
        <span className={`rounded border px-2 py-0.5 text-xs ${CHIP[p.status] ?? ''}`}>
          {p.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="text-center">
        <p
          className={`text-4xl font-bold tabular-nums ${
            isRefund ? 'text-text-primary' : 'hq-revenue'
          }`}
        >
          {isRefund ? '' : '+'}
          {fmt(net, p.currency)}
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-text-muted">
          {isRefund ? 'refund' : 'charged'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Row label="Gross" amount={p.amountMinor ?? 0} currency={p.currency} />
        {p.refundedMinor > 0 && (
          <Row
            label="Refunded"
            amount={-p.refundedMinor}
            currency={p.currency}
            tone="text-accent"
          />
        )}
        <Row label="Net" amount={net} currency={p.currency} />
      </div>

      {p.failureReason && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {p.failureReason}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
        <span>
          {new Date(p.createdAt).toLocaleString('en-ZA', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span>{p.postedToFolio ? '✓ posted to folio' : 'not posted'}</span>
      </div>

      {p.reservationId && (
        <Link
          to={`/app/reservations/${p.reservationId}`}
          className="flex items-center gap-1.5 text-xs text-secondary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open reservation
        </Link>
      )}
    </div>
  );
}
