/* Folio snapshot (blueprint S6 Guest Card anatomy): outstanding balance for
 * the guest's active reservation, read from the reservation payload's
 * embedded folio summary (types: Reservation.folio) — zero extra fetches. */
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '../../lib/guest-utils';

export function FolioSnapshot({ reservation }) {
  const folio = reservation.folio;
  if (!folio && reservation.balance == null) return null;

  const balance = Number(folio?.balance ?? reservation.balance ?? 0);
  const charges = Number(folio?.totalCharges ?? reservation.totalAmount ?? 0);
  const settled = Number(folio?.totalPayments ?? Math.max(charges - balance, 0));

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Current Folio</CardTitle>
        <Link
          to={`/app/reservations/${reservation.id}`}
          className="text-text-muted hover:text-text-primary"
          title="Open reservation"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Balance due
            </p>
            <p
              className={`text-3xl font-semibold tabular-nums ${
                balance > 0 ? 'hq-revenue' : 'text-text-primary'
              }`}
            >
              {formatCurrency(balance)}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {reservation.confirmationNumber}
              {reservation.roomTypeName ? ` · ${reservation.roomTypeName}` : ''}
              {reservation.roomNumber ? ` · Room ${reservation.roomNumber}` : ''}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Charges
              </p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(charges)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Settled
              </p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(settled)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
