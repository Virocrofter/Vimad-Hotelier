/* apps/web/src/app/app/reservations/detail/ReservationWorkspace.jsx
 * Reservation workspace v2 (roadmap addendum 5.3, Phase 3 slice #2).
 * One consistent workspace instead of module-hopping: header with
 * lifecycle-derived actions (only actions legal for the CURRENT state —
 * the server still enforces; P5 M3), sections Overview / Guests / Room & ops
 * / Folio & payments / Messages / Tasks / Timeline, and a change preview for
 * date changes: availability per night, pricing impact, conflicts — before
 * anything is saved (addendum: show impact "before changing dates").
 * Behind the reservationWorkspace flag; mutations reuse the existing,
 * already-tested reservation endpoints.
 */
import { formatMoneyMinor, formatMoney } from '../../../../lib/money';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  BedDouble,
  CalendarDays,
  CreditCard,
  History,
  LogIn,
  LogOut,
  MessageSquare,
  RefreshCw,
  User,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useReservationWorkspace } from '../../../../hooks/useReservations';
import CheckInDialog from '../../../../components/reservations/CheckInDialog';
import { listUpsellProducts, sellUpsell } from '../../../../api/upsell-api';
import { apiClient } from '../../../../api/client';
import {
  checkInReservation,
  checkOutReservation,
  cancelReservation,
  noShowReservation,
  updateReservation,
  resendConfirmation,
} from '../../../../api/api-reservations';
import { cn } from '../../../../lib/utils';

const STATUS = {
  confirmed: {
    label: 'Confirmed',
    cls: 'bg-accent/10 text-[var(--accent-soft-fg)] border-accent/20',
  },
  checked_in: { label: 'In house', cls: 'bg-secondary/10 text-secondary border-secondary/20' },
  checked_out: { label: 'Checked out', cls: 'bg-neutral/10 text-text-muted border-border' },
  cancelled: {
    label: 'Cancelled',
    cls: 'bg-danger/10 text-[var(--danger-soft-fg)] border-danger/20',
  },
  no_show: { label: 'No-show', cls: 'bg-danger/10 text-[var(--danger-soft-fg)] border-danger/20' },
};
const money = (amount, currency = 'ZAR') => formatMoney(amount, currency);
const day = (d) => (d ?? '').slice(0, 10);

function Section({ icon: Icon, title, children, right }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Icon className="h-4 w-4 text-secondary" /> {title}
        </h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DateChangePreview({ d, onSaved }) {
  const [arr, setArr] = useState(day(d.header.arrivalDate));
  const [dep, setDep] = useState(day(d.header.departureDate));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const inNights = [];
  const cur = new Date(arr + 'T12:00:00');
  const end = new Date(dep + 'T12:00:00');
  while (cur < end && inNights.length < 60) {
    inNights.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const oldNights = d.preview.nights.length;
  const valid = inNights.length > 0 && dep > arr;
  const impact = (inNights.length - oldNights) * d.preview.nightlyRate;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated/50 p-3">
      <p className="text-xs font-semibold text-text-primary">
        Change dates — preview before you save
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-text-muted">
          Arrival
          <input
            type="date"
            value={arr}
            onChange={(e) => setArr(e.target.value)}
            className="mt-0.5 block rounded-md border border-border bg-surface px-2 py-1 text-xs"
          />
        </label>
        <label className="text-[11px] text-text-muted">
          Departure
          <input
            type="date"
            value={dep}
            onChange={(e) => setDep(e.target.value)}
            className="mt-0.5 block rounded-md border border-border bg-surface px-2 py-1 text-xs"
          />
        </label>
        <button
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            setErr(null);
            try {
              await updateReservation(d.header.id, {
                arrivalDate: arr,
                departureDate: dep,
                nights: inNights.length,
              });
              onSaved();
            } catch (e) {
              setErr(e?.response?.data?.error?.message ?? e.message);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Apply new dates'}
        </button>
      </div>
      {valid && (
        <div className="mt-2 space-y-1 text-[11px]">
          <p
            className={cn(
              'font-medium',
              impact > 0
                ? 'text-warning'
                : impact < 0
                  ? 'text-accent-foreground'
                  : 'text-text-secondary'
            )}
          >
            {inNights.length} nights ({oldNights} before) · pricing impact {impact > 0 ? '+' : ''}
            {money(impact, d.preview.currency)} at{' '}
            {money(d.preview.nightlyRate, d.preview.currency)}/night
          </p>
          <p className="text-text-muted">
            Availability for this room type:{' '}
            {inNights.map((n) => n.toISOString().slice(5, 10)).join(', ')} — confirm against the
            room plan; channel re-sync runs on save.
          </p>
        </div>
      )}
      {err && <p className="mt-1 text-[11px] text-danger">{err}</p>}
    </div>
  );
}

// 4.5 — group rooming list: sibling reservations of the same block
// (guest, room, status, balance). Renders nothing for non-group stays.
function GroupSection({ groupId, currency }) {
  const [group, setGroup] = useState(null);
  useEffect(() => {
    if (!groupId) return;
    apiClient
      .get('/groups/' + groupId)
      .then((r) => setGroup(r?.data?.data ?? r?.data))
      .catch(() => setGroup(null));
  }, [groupId]);
  if (!groupId || !group) return null;
  const members = group.reservations ?? group.members ?? [];
  return (
    <Section
      icon={Users}
      title={'Group — ' + (group.name ?? 'block')}
      right={
        <a href="/app/groups" className="text-[11px] text-text-muted underline">
          Open groups
        </a>
      }
    >
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-text-secondary">
              {m.guestName ??
                (m.guest ? m.guest.firstName + ' ' + m.guest.lastName : null) ??
                m.confirmationNumber}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-text-muted">
              <span>{m.assignedRoom?.number ?? m.roomNumber ?? '—'}</span>
              <span className={m.status === 'checked_in' ? 'text-accent-foreground' : ''}>
                {String(m.status ?? '').replace(/_/g, ' ')}
              </span>
              <span className="hq-tnum">{money(Number(m.balance ?? 0), currency)}</span>
            </span>
          </li>
        ))}
        {members.length === 0 && (
          <li className="text-xs text-text-muted">No members listed on the group detail yet.</li>
        )}
      </ul>
    </Section>
  );
}

// 4.4 — reservation document repository: list, upload (base64 -> putFile),
// and the signature workflow (pending -> signed, with deadlines).
function DocumentsSection({ reservationId }) {
  const [docs, setDocs] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [sig, setSig] = useState('n_a');
  const [file, setFile] = useState(null);

  const load = useCallback(() => {
    apiClient
      .get('/files/documents', { params: { reservationId } })
      .then((r) => {
        const d = r?.data?.data ?? r?.data ?? [];
        setDocs(Array.isArray(d) ? d : (d.documents ?? []));
      })
      .catch((e) => setErr(e?.response?.data?.error?.message ?? 'Failed to load documents'));
  }, [reservationId]);
  useEffect(load, [load]);

  const upload = async () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await apiClient.post('/files/documents', {
        reservationId,
        name: name.trim(),
        category,
        signatureStatus: sig,
        contentBase64,
      });
      setName('');
      setFile(null);
      setSig('n_a');
      load();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const markSigned = (doc) => {
    apiClient
      .patch(`/files/documents/${doc.id}`, {
        signatureStatus: 'signed',
        signedAt: new Date().toISOString(),
      })
      .then(load)
      .catch((e) => setErr(e?.response?.data?.error?.message ?? 'Update failed'));
  };

  const fmtDate = (x) => (x ? new Date(x).toISOString().slice(0, 10) : '—');

  return (
    <Section
      icon={FileText}
      title="Documents"
      right={<span className="text-xs text-text-muted">{docs?.length ?? 0} files</span>}
    >
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {(docs ?? []).map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-text-secondary">
              {doc.name} <span className="text-text-muted">({doc.category})</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={
                  doc.signatureStatus === 'signed' ? 'text-accent-foreground' : 'text-text-muted'
                }
              >
                {doc.signatureStatus === 'signed'
                  ? `signed ${fmtDate(doc.signedAt)}`
                  : doc.signatureStatus === 'pending'
                    ? 'signature pending'
                    : 'no signature'}
              </span>
              {doc.signatureStatus === 'pending' && (
                <button
                  onClick={() => markSigned(doc)}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-surface-elevated"
                >
                  Mark signed
                </button>
              )}
              {doc.deadline && <span className="text-text-muted">due {fmtDate(doc.deadline)}</span>}
            </span>
          </li>
        ))}
        {docs && docs.length === 0 && (
          <li className="text-xs text-text-muted">No documents on this stay.</li>
        )}
      </ul>
      <div className="mt-2 space-y-1.5 border-t border-border pt-2">
        <div className="flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Document name (e.g. registration-card.pdf)"
            className="flex-1 rounded border border-border bg-surface px-2 py-1 text-[11px]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-[11px]"
          >
            <option value="other">Other</option>
            <option value="registration">Registration</option>
            <option value="waiver">Waiver</option>
            <option value="contract">Contract</option>
          </select>
          <select
            value={sig}
            onChange={(e) => setSig(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-[11px]"
          >
            <option value="n_a">No signature</option>
            <option value="pending">Signature pending</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-[11px] text-text-secondary"
          />
          <button
            onClick={upload}
            disabled={busy || !file || !name.trim()}
            className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
          >
            {busy ? '…' : 'Upload'}
          </button>
        </div>
        {err && <p className="text-[11px] text-danger">{err}</p>}
      </div>
    </Section>
  );
}

// 4.2 — attach an upsell product to the stay through the sellProduct
// chokepoint (sellUpsell). ≤3 clicks: open → pick → Add.
function AddItemPanel({ reservationId, currency, onDone }) {
  const [products, setProducts] = useState(null);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    listUpsellProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);
  const submit = async () => {
    if (!productId) return;
    setBusy(true);
    setErr(null);
    try {
      await sellUpsell({ productId, reservationId, quantity: Number(qty) || 1 });
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Could not add the item');
      setBusy(false);
    }
  };
  return (
    <div className="mb-2 space-y-1.5 rounded-lg border border-border bg-surface-elevated/40 p-2">
      <div className="flex gap-1.5">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="flex-1 rounded border border-border bg-surface px-2 py-1 text-[11px]"
        >
          <option value="">Pick an upsell product…</option>
          {(products ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {money(p.price, currency)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-14 rounded border border-border bg-surface px-2 py-1 text-[11px]"
        />
        <button
          onClick={submit}
          disabled={busy || !productId}
          className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
        >
          {busy ? '…' : 'Add'}
        </button>
      </div>
      {err && <p className="text-[11px] text-danger">{err}</p>}
    </div>
  );
}

export default function ReservationWorkspace({ reservationId }) {
  const q = useReservationWorkspace(reservationId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const [actionErr, setActionErr] = useState(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['reservations', 'workspace', reservationId] });

  const run = async (action) => {
    if (action === 'check-in') {
      setCheckInOpen(true);
      return;
    }
    setBusy(action);
    setActionErr(null);
    try {
      if (action === 'check-in') await checkInReservation(reservationId);
      else if (action === 'check-out') await checkOutReservation(reservationId);
      else if (action === 'cancel') await cancelReservation(reservationId, 'workspace');
      else if (action === 'no-show') await noShowReservation(reservationId);
      await invalidate();
    } catch (e) {
      setActionErr(e?.response?.data?.error?.message ?? e.message);
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading)
    return (
      <div className="p-6">
        <div className="h-40 animate-pulse rounded-xl bg-surface-elevated" />
      </div>
    );
  if (q.isError) {
    return (
      <div className="m-6 rounded-xl border border-danger/30 bg-surface p-6 text-center">
        <p className="text-sm font-medium">Workspace failed to load</p>
        <p className="mt-1 text-xs text-text-secondary">
          {q.error?.response?.data?.error?.message ?? q.error?.message}
        </p>
        <button
          onClick={() => q.refetch()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }
  const d = q.data;
  const h = d.header;
  const st = STATUS[h.status] ?? STATUS.confirmed;

  return (
    <div className="space-y-4 p-6">
      {/* Header: identity, stay facts, balance/settlement, lifecycle-valid actions */}
      <header className="glass sticky top-14 z-20 rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-text-primary">
                {h.guest.firstName} {h.guest.lastName}
              </h2>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', st.cls)}>
                {st.label}
              </span>
              <span className="text-xs text-text-muted">
                {h.confirmationNumber} · {h.source}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {day(h.arrivalDate)} → {day(h.departureDate)} · {h.nights} nights · {h.adults} adult
              {h.adults > 1 ? 's' : ''}
              {h.children ? ` · ${h.children} child` : ''}
              {h.roomType ? ` · ${h.roomType.name}` : ''}
              {h.assignedRoom ? ` · Room ${h.assignedRoom.number}` : ' · unassigned'}
              {h.eta ? ` · ETA ${h.eta}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                'text-lg font-bold',
                h.balance > 0 ? 'text-warning' : 'text-accent-foreground'
              )}
            >
              {money(h.balance, d.preview.currency)} {h.balance > 0 ? 'owing' : 'settled'}
            </p>
            <p className="text-[11px] text-text-muted">
              total {money(h.totalAmount, d.preview.currency)} · deposit{' '}
              {money(h.depositPaid, d.preview.currency)}/{money(h.depositDue, d.preview.currency)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {d.validActions.map((a) => (
            <button
              key={a.action}
              disabled={busy === a.action || (a.action === 'check-out' && Number(h.balance) > 0)}
              title={
                a.action === 'check-out' && Number(h.balance) > 0
                  ? 'Settle the balance before check-out'
                  : undefined
              }
              onClick={() => run(a.action)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50',
                a.action === 'check-in' && 'bg-primary',
                a.action === 'check-out' && 'bg-secondary',
                a.action === 'cancel' && 'bg-danger',
                a.action === 'no-show' && 'bg-warning',
                a.action === 'take-payment' && 'bg-info'
              )}
            >
              {busy === a.action ? '…' : a.label}
            </button>
          ))}
          {d.validActions.length === 0 && (
            <span className="text-xs text-text-muted">No actions available in this state.</span>
          )}
          {actionErr && <span className="text-xs text-danger">{actionErr}</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          {[
            ['Billing', '/app/billing'],
            ['Tape chart', '/app/rooms'],
            ['Keys', '/app/keys'],
            ['Task', '/app/tasks'],
          ].map(([label, to]) => (
            <a
              key={label}
              href={to}
              className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-elevated"
            >
              {label}
            </a>
          ))}
          <button
            onClick={() => window.print()}
            className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-elevated"
          >
            Print
          </button>
        </div>
      </header>

      {checkInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <CheckInDialog
            reservationId={reservationId}
            room={h.assignedRoom}
            onClose={() => setCheckInOpen(false)}
            onCheckedIn={invalidate}
          />
        </div>
      )}

      <DateChangePreview d={d} onSaved={invalidate} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          icon={User}
          title="Guests"
          right={<span className="text-xs text-text-muted">{1 + d.companions.length}</span>}
        >
          <p className="text-sm font-medium text-text-primary">
            {h.guest.firstName} {h.guest.lastName}
          </p>
          <p className="text-xs text-text-secondary">
            {h.guest.email} {h.guest.phone ? `· ${h.guest.phone}` : ''}
          </p>
          {h.specialRequests && (
            <p className="mt-2 text-xs text-warning">Requests: {h.specialRequests}</p>
          )}
          {d.companions.map((c) => (
            <p key={c.id} className="mt-1 text-xs text-text-secondary">
              ＋ {c.firstName} {c.lastName}
              {c.sharesFolio ? ' · shares folio' : ''}
            </p>
          ))}
        </Section>

        <Section
          icon={BedDouble}
          title="Room & operations"
          right={
            <Link to="/app/room-plan" className="text-xs text-secondary hover:underline">
              Room plan →
            </Link>
          }
        >
          <p className="text-sm text-text-primary">
            {h.roomType?.name ?? 'No room type'}{' '}
            {h.assignedRoom
              ? `— Room ${h.assignedRoom.number} (${h.assignedRoom.housekeepingStatus})`
              : '— not yet assigned'}
          </p>
          {h.guaranteed && <p className="mt-1 text-xs text-accent-foreground">Guaranteed</p>}
          {d.tasks.length > 0 && (
            <ul className="mt-2 space-y-1">
              {d.tasks.slice(0, 5).map((t) => (
                <li key={t.id} className="text-xs text-text-secondary">
                  • {t.title}{' '}
                  <span className="text-text-muted">
                    ({t.department}, {t.status})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          icon={CreditCard}
          title="Folio & payments"
          right={
            <span className="flex items-center gap-2">
              <button
                onClick={() => setAddItemOpen((v) => !v)}
                className="rounded border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:bg-surface-elevated"
              >
                Add item
              </button>
              <a
                href={'/app/split-bill?reservation=' + reservationId}
                className="rounded border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:bg-surface-elevated"
              >
                Split bills
              </a>
              <span className="text-xs text-text-muted">
                {money(h.balance, d.preview.currency)}
              </span>
            </span>
          }
        >
          {addItemOpen && (
            <AddItemPanel
              reservationId={reservationId}
              currency={d.preview.currency}
              onDone={() => {
                setAddItemOpen(false);
                invalidate();
              }}
            />
          )}
          {d.folio ? (
            <>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {d.folio.items.map((i) => (
                  <li key={i.id} className="flex justify-between text-xs">
                    <span className="text-text-secondary">
                      {i.description} ×{i.quantity}
                    </span>
                    <span className="font-mono text-text-primary">
                      {money(i.amount, d.preview.currency)}
                    </span>
                  </li>
                ))}
                {d.folio.items.length === 0 && (
                  <li className="text-xs text-text-muted">No charges posted yet.</li>
                )}
              </ul>
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {d.payments.map((p) => (
                  <p key={p.id} className="flex justify-between text-xs">
                    <span className="text-text-secondary">
                      {p.reference}{' '}
                      <span
                        className={cn(
                          p.status === 'success' ? 'text-accent-foreground' : 'text-warning'
                        )}
                      >
                        {p.status}
                      </span>
                    </span>
                    <span className="font-mono text-text-primary">
                      {formatMoneyMinor(p.amountMinor, p.currency ?? d.preview.currency)}
                    </span>
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted">No folio yet.</p>
          )}
        </Section>

        <Section
          icon={MessageSquare}
          title="Messages"
          right={
            <span className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setActionErr(null);
                  try {
                    await resendConfirmation(reservationId);
                  } catch (e) {
                    setActionErr(e?.response?.data?.error?.message ?? 'Resend failed');
                  }
                }}
                className="rounded border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:bg-surface-elevated"
              >
                Resend confirmation
              </button>
              <span className="text-xs text-text-muted">
                {d.messages.length} thread{d.messages.length === 1 ? '' : 's'}
              </span>
            </span>
          }
        >
          {d.messages.length === 0 ? (
            <p className="text-xs text-text-muted">No guest messages on this stay.</p>
          ) : (
            d.messages.map((t) => (
              <p key={t.id} className="text-xs text-text-secondary">
                {t.lastMessage ? t.lastMessage.body : '—'}{' '}
                <span className="text-text-muted">
                  ({t.status}
                  {t.unreadForStaff ? ` · ${t.unreadForStaff} unread` : ''})
                </span>
              </p>
            ))
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={CalendarDays} title="Traces & flags">
          {d.traces.length === 0 ? (
            <p className="text-xs text-text-muted">No traces.</p>
          ) : (
            d.traces.map((t) => (
              <p key={t.id} className="text-xs text-text-secondary">
                ⚑ {t.body} <span className="text-text-muted">({t.department})</span>
              </p>
            ))
          )}
        </Section>
        <GroupSection groupId={h.groupId} currency={d.preview.currency} />

        <DocumentsSection reservationId={reservationId} />

        <Section icon={History} title="Timeline / audit">
          {d.timeline.length === 0 ? (
            <p className="text-xs text-text-muted">No recorded changes.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {d.timeline.map((t, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="shrink-0 text-text-muted">{day(t.at)}</span>
                  <span className="font-medium text-text-primary">{t.action}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
