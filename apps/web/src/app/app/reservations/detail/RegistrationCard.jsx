/* RegistrationCard (4.1b) — staff-side printable registration card over the
 * workspace header data. Signature + date lines mirror the guest-portal
 * check-in card's contract; the global print stylesheet (hiding app chrome)
 * rides the separate print-CSS item, so v1 previews in a modal. */
import { formatMoney } from '../../../../lib/money';

const money = (n, currency = 'ZAR') => formatMoney(Number(n) || 0, currency);
const day = (d) => (d ? new Date(d).toLocaleDateString('en-ZA') : '—');

export default function RegistrationCard({ h, propertyName, currency = 'ZAR' }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-surface p-8 text-text-primary">
      <div className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <p className="text-lg font-bold">{propertyName ?? 'Property'}</p>
          <p className="text-xs text-text-muted">Guest registration card</p>
        </div>
        <p className="font-mono text-sm text-text-secondary">{h.confirmationNumber}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-text-muted">Guest</dt>
          <dd className="font-medium">
            {h.guest.firstName} {h.guest.lastName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Source</dt>
          <dd>{h.source}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Arrival</dt>
          <dd>{day(h.arrivalDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Departure</dt>
          <dd>{day(h.departureDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Room</dt>
          <dd>
            {h.roomType?.name ?? '—'}
            {h.assignedRoom ? ` · ${h.assignedRoom.number}` : ' · unassigned'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Party</dt>
          <dd>
            {h.adults} adult{h.adults > 1 ? 's' : ''}
            {h.children ? ` · ${h.children} child` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Stay total</dt>
          <dd className="font-mono tabular-nums">{money(h.totalAmount, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Balance on arrival</dt>
          <dd className="font-mono tabular-nums">{money(h.balance, currency)}</dd>
        </div>
      </dl>

      <p className="mt-5 border-t border-border pt-3 text-[11px] leading-relaxed text-text-secondary">
        The guest acknowledges the house rules, the rate and cancellation policy of the booking, and
        accepts responsibility for charges posted to this reservation during the stay.
      </p>

      <div className="mt-8 flex items-end gap-8">
        <div className="flex-1">
          <div className="border-b border-border pb-1 text-sm">&nbsp;</div>
          <p className="mt-1 text-xs text-text-muted">Guest signature</p>
        </div>
        <div className="w-40">
          <div className="border-b border-border pb-1 text-sm">&nbsp;</div>
          <p className="mt-1 text-xs text-text-muted">Date</p>
        </div>
      </div>
    </div>
  );
}
