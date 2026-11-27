/* apps/web/src/app/app/till/page.jsx — F5 native till: open checks with
 * line items, split-by-move, comps with reversal, exact-tender close
 * (cash/card/voucher/room), and cash-up sessions with variance. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProperties } from '../../../hooks/useProperties';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';
import {
  Loader2,
  Plus,
  RefreshCw,
  Receipt,
  Split,
  Undo2,
  BadgePercent,
  Lock,
  Banknote,
  Wallet,
} from 'lucide-react';

const fmt = (n) =>
  `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toMinor = (n) => Math.round(Number(n) * 100);
const toMajor = (minor) => (Number(minor || 0) / 100).toFixed(2);

export default function TillPage() {
  const { properties } = useProperties();
  const property = properties?.[0];
  const [checks, setChecks] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [err, setErr] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [session, setSession] = useState(null); // cash-up form state
  const [closing, setClosing] = useState(null); // check being closed

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stable refresh identity drives the polling effect
  const refresh = useCallback(async () => {
    if (!property?.id) return;
    try {
      const [c, s] = await Promise.all([
        apiClient.get('/till/checks', { params: { propertyId: property.id } }),
        apiClient.get('/till/sessions', { params: { propertyId: property.id } }),
      ]);
      setChecks(c?.data?.data ?? []);
      setSessions(s?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e?.data?.error?.msg ?? 'Till failed to load');
    }
  }, [property?.id]);

  useEffect(() => {
    Promise.resolve().then(refresh);
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  const openChecks = useMemo(() => (checks ?? []).filter((c) => c.status === 'open'), [checks]);
  const openSession = sessions.find((s) => s.status === 'open');

  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast({ title: ok });
      await refresh();
    } catch (e) {
      toast({ title: 'Failed', description: e?.data?.error?.msg, variant: 'destructive' });
    }
  };

  const payable = (c) => Number(c.totalCharges) - Number(c.totalComps);

  if (!property) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-sm text-text-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading property…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Till</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Open checks, split, comps, close with mixed tenders, cash up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
          >
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Refresh
          </button>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Table / guest name"
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
          <button
            disabled={!newLabel.trim()}
            onClick={() =>
              act(
                () =>
                  apiClient.post('/till/checks', {
                    propertyId: property.id,
                    label: newLabel.trim(),
                  }),
                'Check opened'
              ).then(() => setNewLabel(''))
            }
            className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Open check
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      {/* Cash-up strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <Banknote className="h-5 w-5 text-text-muted" />
        {openSession ? (
          <>
            <span className="text-sm text-text-secondary">
              Session open · float {fmt(toMajor(openSession.openingFloatMinor))}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Counted cash (R)"
              className="h-9 w-36 rounded-md border border-border bg-background px-3 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  act(
                    () =>
                      apiClient.post(`/till/sessions/${openSession.id}/close`, {
                        countedCashMinor: toMinor(e.currentTarget.value),
                      }),
                    'Session closed'
                  );
                }
              }}
            />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">No session open.</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Opening float (R)"
              className="h-9 w-36 rounded-md border border-border bg-background px-3 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value !== '') {
                  act(
                    () =>
                      apiClient.post('/till/sessions/open', {
                        propertyId: property.id,
                        openingFloatMinor: toMinor(e.currentTarget.value),
                      }),
                    'Session opened'
                  );
                }
              }}
            />
          </div>
        )}
        {sessions[0]?.status === 'closed' && (
          <span className="ml-auto text-xs text-text-muted">
            Last close: expected {fmt(toMajor(sessions[0].expectedCashMinor))} · counted{' '}
            {fmt(toMajor(sessions[0].countedCashMinor))} · variance{' '}
            <span className={sessions[0].varianceMinor === 0 ? 'text-emerald-600' : 'text-danger'}>
              {fmt(toMajor(sessions[0].varianceMinor))}
            </span>
          </span>
        )}
      </div>

      {/* Checks grid */}
      {!checks && <p className="text-sm text-text-muted">Loading…</p>}
      {checks && openChecks.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          No open checks — open one to start ringing up.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {openChecks.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary">{c.label}</span>
              <span className="text-sm text-text-muted">{fmt(payable(c))} due</span>
            </div>

            <div className="mt-2 space-y-1">
              {c.items
                .filter((i) => !i.reversed)
                .map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={i.comped ? 'line-through text-text-muted' : 'text-text-secondary'}
                    >
                      {i.quantity} × {i.name}
                      {i.comped ? ` (comp: ${i.compReason ?? '—'})` : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={i.comped ? 'text-text-muted line-through' : ''}>
                        {fmt(Number(i.unitPrice) * i.quantity)}
                      </span>
                      <button
                        title={i.comped ? 'Reverse comp' : 'Comp this item'}
                        onClick={() =>
                          act(
                            () =>
                              i.comped
                                ? apiClient.post(`/till/items/${i.id}/reverse-comp`)
                                : apiClient.post(`/till/items/${i.id}/comp`, {
                                    reason: window.prompt('Comp reason?') ?? 'Staff comp',
                                  }),
                            i.comped ? 'Comp reversed' : 'Item comped'
                          )
                        }
                        className="rounded border border-border p-1 text-text-muted hover:text-text-primary"
                      >
                        {i.comped ? (
                          <Undo2 className="h-3 w-3" />
                        ) : (
                          <BadgePercent className="h-3 w-3" />
                        )}
                      </button>
                      <select
                        title="Move to check"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          act(
                            () =>
                              apiClient.post(`/till/items/${i.id}/move`, {
                                toCheckId: e.target.value,
                              }),
                            'Item moved'
                          );
                        }}
                        className="h-6 rounded border border-border bg-background text-[11px]"
                      >
                        <option value="">Move…</option>
                        {openChecks
                          .filter((o) => o.id !== c.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                      </select>
                    </span>
                  </div>
                ))}
            </div>

            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <input
                placeholder="Item name"
                className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    const name = e.currentTarget.value.trim();
                    const price = window.prompt(`Price for "${name}" (R)?`, '0');
                    if (price === null) return;
                    act(
                      () =>
                        apiClient.post(`/till/checks/${c.id}/items`, {
                          name,
                          unitPrice: Number(price),
                        }),
                      'Item added'
                    );
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button
                onClick={() => setClosing(c)}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-secondary px-3 text-xs font-medium text-white"
              >
                <Lock className="h-3.5 w-3.5" /> Close
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Close dialog */}
      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                Close {closing.label} — {fmt(payable(closing))}
              </h2>
              <button onClick={() => setClosing(null)} className="text-text-muted">
                ✕
              </button>
            </div>
            <CloseForm
              check={closing}
              onDone={() => {
                setClosing(null);
                refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CloseForm({ check, onDone }) {
  const [rows, setRows] = useState([{ method: 'cash', amount: '' }]);
  const [reservationId, setReservationId] = useState('');
  const [busy, setBusy] = useState(false);

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const payable = Number(check.totalCharges) - Number(check.totalComps);

  const submit = async () => {
    setBusy(true);
    try {
      const payments = rows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          method: r.method,
          amountMinor: toMinor(r.amount),
          ...(r.method === 'room' && reservationId ? { reservationId } : {}),
        }));
      await apiClient.post(`/till/checks/${check.id}/close`, { payments });
      toast({ title: 'Check closed' });
      onDone();
    } catch (e) {
      toast({ title: 'Close failed', description: e?.data?.error?.msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <select
            value={r.method}
            onChange={(e) =>
              setRows(rows.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))
            }
            className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="voucher">Voucher</option>
            <option value="room">Room charge</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={r.amount}
            onChange={(e) =>
              setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
            }
            placeholder="Amount (R)"
            className="h-9 w-32 rounded-md border border-border bg-background px-2 text-sm"
          />
          <button
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            className="rounded-md border border-border px-2 text-text-muted"
          >
            ✕
          </button>
        </div>
      ))}
      {rows.some((r) => r.method === 'room') && (
        <input
          value={reservationId}
          onChange={(e) => setReservationId(e.target.value)}
          placeholder="Reservation ID for the room charge"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      )}
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => setRows([...rows, { method: 'card', amount: '' }])}
          className="text-xs text-text-muted underline"
        >
          + Add tender
        </button>
        <span className={Math.abs(total - payable) < 0.005 ? 'text-emerald-600' : 'text-danger'}>
          {fmt(total)} / {fmt(payable)}
        </span>
      </div>
      <button
        onClick={submit}
        disabled={busy || Math.abs(total - payable) >= 0.005}
        className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Close check'}
      </button>
    </div>
  );
}
