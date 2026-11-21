/* apps/web/src/app/app/billing/components/TransactionSheet.jsx
 * Blueprint S6 TransactionSheet — receipt modal for a single folio item:
 * signed amount, status pill, method, bill/reservation links, dotted-leader
 * rows. Opened by clicking any row in the folio transaction table; Reverse
 * and View receipt hand back to the page's existing modals.
 */
import React from 'react';
import { X, Receipt, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Button } from '@/components/ui/button';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount || 0);
}

const METHOD_LABELS = {
  room_charge: 'Room charge',
  tax: 'Tax',
  service: 'Service',
  incidental: 'Incidental',
  adjustment: 'Adjustment',
  penalty: 'Penalty',
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  check: 'Check',
  voucher: 'Voucher',
  refund: 'Refund',
  payment: 'Payment',
  deposit: 'Deposit',
};

function Leader({ label, children }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 text-sm">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="mx-1 flex-1 border-b border-dotted border-border" />
      <span className="shrink-0 text-right text-text-primary">{children}</span>
    </div>
  );
}

export default function TransactionSheet({
  tx,
  folio,
  guestName,
  onClose,
  onReverse,
  onViewReceipt,
}) {
  if (!tx) return null;
  const payment = tx.payment > 0;
  const isReversal = /revers/i.test(tx.description || '') || Number(tx.raw?.amount) < 0;
  const method = METHOD_LABELS[String(tx.raw?.type || '').toLowerCase()] || tx.raw?.type || '—';
  const confirmation = folio?.reservation?.confirmationNumber;
  const reservationId = folio?.reservationId || folio?.reservation?.id;
  const canReverse = !payment && folio?.status === 'open' && !isReversal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">Transaction</h2>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  payment
                    ? 'bg-accent/10 text-[var(--accent-soft-fg)]'
                    : 'bg-info/10 text-[var(--info-soft-fg)]'
                )}
              >
                {payment ? 'Payment' : 'Charge'}
              </span>
              {isReversal && (
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                  Reversal
                </span>
              )}
            </div>
            <p className="mt-0.5 font-mono text-xs text-text-muted">#{String(tx.id).slice(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Signed amount */}
        <div className="border-b border-border px-5 py-5 text-center">
          <p
            className={cn(
              'text-3xl font-bold font-mono tabular-nums',
              payment ? 'text-[var(--accent-soft-fg)]' : 'text-text-primary'
            )}
          >
            {payment ? '−' : '+'}
            {formatCurrency(payment ? tx.payment : tx.charge)}
          </p>
          <p className="mt-1 text-sm text-text-secondary">{tx.description}</p>
        </div>

        {/* Dotted-leader detail rows */}
        <div className="px-5 py-3">
          <Leader label="Date posted">{tx.date || '—'}</Leader>
          <Leader label="Code">
            <span className="font-mono">{tx.code}</span>
          </Leader>
          <Leader label="Method">{method}</Leader>
          <Leader label="Window">
            {tx.routing === 'company' ? 'Company / Master' : 'Guest Folio'}
          </Leader>
          {guestName && <Leader label="Guest">{guestName}</Leader>}
          {confirmation && (
            <Leader label="Reservation">
              <span className="font-mono">{confirmation}</span>
            </Leader>
          )}
          <Leader label="Folio status">
            <span className="capitalize">{folio?.status || '—'}</span>
          </Leader>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          {onViewReceipt && (
            <Button variant="outline" size="sm" onClick={onViewReceipt}>
              <Receipt className="mr-1.5 h-4 w-4" /> View receipt
            </Button>
          )}
          {reservationId && (
            <a href={`/app/reservations/${reservationId}`}>
              <Button variant="outline" size="sm">
                <ArrowRight className="mr-1.5 h-4 w-4" /> Open reservation
              </Button>
            </a>
          )}
          <div className="flex-1" />
          {canReverse && (
            <Button
              variant="outline"
              size="sm"
              className="text-[var(--danger-soft-fg)] border-danger/30 hover:bg-danger/10"
              onClick={() => onReverse?.(tx)}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reverse
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
