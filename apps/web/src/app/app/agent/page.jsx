/* apps/web/src/app/app/agent/page.jsx — D8 travel-agent portal UI. Scoped to
 * the signed-in agent's account by the API (403 for everyone else, surfaced
 * honestly). Contract card, open balance, bookings, invoices, self-service
 * booking at NET with the contract cutoff enforced server-side. */
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';

const friendly = (e) =>
  e?.data?.error?.code === 'FORBIDDEN'
    ? 'The agent portal is for travel-agent accounts only.'
    : (e?.data?.error?.msg ?? e?.data?.error?.code ?? 'Request failed');

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const Badge = ({ status }) => {
  const tone =
    status === 'connected'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'paid'
        ? 'bg-emerald-100 text-emerald-800'
        : status === 'overdue' || status === 'failed'
          ? 'bg-red-100 text-red-800'
          : 'bg-amber-100 text-amber-800';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{status}</span>
  );
};

export default function AgentPortalPage() {
  const [overview, setOverview] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    guestFirstName: '',
    guestLastName: '',
    guestEmail: '',
    roomTypeId: '',
    arrivalDate: iso(3),
    departureDate: iso(5),
    grossAmount: '',
  });
  const [made, setMade] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [o, b, i] = await Promise.all([
        apiClient.get('/agents/portal/overview'),
        apiClient.get('/agents/portal/bookings'),
        apiClient.get('/agents/portal/invoices'),
      ]);
      setOverview(o?.data?.data ?? null);
      setBookings(b?.data?.data ?? []);
      setInvoices(i?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(friendly(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await apiClient.post('/agents/portal/bookings', {
        ...form,
        grossAmount: Number(form.grossAmount),
        guestEmail: form.guestEmail || undefined,
      });
      const d = r?.data?.data;
      setMade(d);
      toast({ title: `Booked — ${d.confirmationNumber} (net R ${d.netAmount})` });
      await refresh();
    } catch (e) {
      toast({ title: 'Booking failed', description: friendly(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (err) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-text-primary">Agent Portal</h1>
        <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {err}
        </p>
      </div>
    );
  }

  const a = overview?.account;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Agent Portal</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {a ? `${a.name} — your contract, bookings and invoices.` : 'Loading…'}
        </p>
      </div>

      {a && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Commission</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">
              {a.commissionPct != null ? `${a.commissionPct}%` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Booking cutoff</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{a.cutoffDays} day(s)</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Net rate discount</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">
              {a.netRateDiscountPct != null ? `${a.netRateDiscountPct}%` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">Open balance</p>
            <p className="mt-1 font-mono text-xl font-bold text-text-primary">
              R {overview.openBalance?.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">New booking (priced at net)</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={form.guestFirstName}
            onChange={(e) => setForm({ ...form, guestFirstName: e.target.value })}
            placeholder="Guest first name"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <input
            value={form.guestLastName}
            onChange={(e) => setForm({ ...form, guestLastName: e.target.value })}
            placeholder="Guest last name"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <input
            value={form.guestEmail}
            onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
            placeholder="Guest email (optional)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <input
            value={form.roomTypeId}
            onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
            placeholder="Room type ID"
            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-text-primary"
          />
          <input
            type="date"
            value={form.arrivalDate}
            onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <input
            type="date"
            value={form.departureDate}
            onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <input
            value={form.grossAmount}
            onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}
            placeholder="Gross amount (ZAR)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <button
            onClick={create}
            disabled={
              busy ||
              !form.guestFirstName ||
              !form.guestLastName ||
              !form.roomTypeId ||
              !form.grossAmount
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Book at net
          </button>
        </div>
        {made && (
          <p className="mt-2 text-xs text-text-muted">
            Last booking: {made.confirmationNumber} — gross R {made.grossAmount}, net R{' '}
            {made.netAmount} ({made.nights} night{made.nights > 1 ? 's' : ''})
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Bookings ({bookings?.length ?? 0})
          </h2>
          <div className="mt-2 space-y-1 text-xs text-text-secondary">
            {(bookings ?? []).map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-2 border-b border-border/50 py-1"
              >
                <Badge status={b.status} />
                <span>{b.guest}</span>
                <span className="font-mono">{b.confirmationNumber}</span>
                <span>{String(b.arrivalDate).slice(0, 10)}</span>
                <span className="font-mono">R {b.grossAmount}</span>
              </div>
            ))}
            {bookings && bookings.length === 0 && (
              <p className="text-text-muted">No bookings yet.</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Invoices ({invoices?.length ?? 0})
          </h2>
          <div className="mt-2 space-y-1 text-xs text-text-secondary">
            {(invoices ?? []).map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center gap-2 border-b border-border/50 py-1"
              >
                <Badge status={inv.status} />
                <span className="font-mono">{inv.number}</span>
                <span className="font-mono">R {inv.balance} due</span>
                <span>of R {inv.total}</span>
              </div>
            ))}
            {invoices && invoices.length === 0 && (
              <p className="text-text-muted">No invoices yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
