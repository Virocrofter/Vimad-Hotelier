/* /app/split-bill — Phase 3/4: split a stay's folio into bills and move line
   items between them. Rides P24 (N folios per stay) + group-billing's audited
   move primitive. dnd-kit drag deliberately deferred to the Phase 4 motion pass. */
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../api/client';
import { formatMoney } from '../../../lib/money';

const reservationId = new URLSearchParams(window.location.search).get('reservation');

export default function SplitBillPage() {
  const [bills, setBills] = useState([]);
  const [guest, setGuest] = useState('');
  const [selected, setSelected] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!reservationId) return;
    setErr(null);
    try {
      const list = await apiClient.get('/folios', { params: { reservationId } });
      const raw = list?.data?.data ?? list?.data ?? [];
      const folios = Array.isArray(raw) ? raw : (raw.folios ?? raw.items ?? []);
      const detailed = await Promise.all(
        (folios.length ? folios : []).map((f) =>
          apiClient
            .get('/folios/' + f.id)
            .then((r) => r?.data?.data ?? r?.data)
            .catch(() => f)
        )
      );
      setBills(detailed);
      const res = await apiClient.get('/reservations/' + reservationId).catch(() => null);
      const r = res?.data?.data ?? res?.data;
      setGuest(r?.guestName ?? r?.confirmationNumber ?? '');
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Failed to load bills');
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const addBill = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post('/folios', { reservationId });
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Failed to create bill');
    } finally {
      setBusy(false);
    }
  };

  const moveSelected = async (targetId) => {
    if (!targetId || selected.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      await Promise.all(
        selected.map((itemId) =>
          apiClient.post('/folios/move-item', { itemId, targetFolioId: targetId })
        )
      );
      setSelected([]);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Move failed');
    } finally {
      setBusy(false);
    }
  };

  if (!reservationId) {
    return <div className="p-6 text-sm text-danger">Missing ?reservation= parameter.</div>;
  }

  const otherBills = (billId) => bills.filter((b) => b.id !== billId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="hq-text-title font-semibold">Split bills {guest && `— ${guest}`}</h1>
          <p className="hq-text-caption text-text-muted">
            Move line items between bills. Every move is audited.
          </p>
        </div>
        <button
          onClick={addBill}
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          + New bill
        </button>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bills.map((bill) => (
          <div key={bill.id} className="hq-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Bill {bills.indexOf(bill) + 1} · {bill.status}
              </span>
              <span className="hq-tnum text-sm font-semibold">
                {formatMoney(Number(bill.balance ?? 0))}
              </span>
            </div>
            <div className="space-y-1">
              {(bill.items ?? []).map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-surface-elevated"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, item.id] : s.filter((i) => i !== item.id)
                      )
                    }
                  />
                  <span className="flex-1 truncate">{item.description}</span>
                  <span className="hq-tnum">{formatMoney(Number(item.amount))}</span>
                </label>
              ))}
              {(bill.items ?? []).length === 0 && (
                <p className="px-2 py-1 text-[11px] text-text-muted">No line items.</p>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <select
                className="flex-1 rounded border border-border bg-surface px-2 py-1 text-[11px]"
                value=""
                disabled={busy || selected.length === 0 || otherBills(bill.id).length === 0}
                onChange={(e) => moveSelected(e.target.value)}
              >
                <option value="">
                  {selected.length > 0
                    ? `Move ${selected.length} selected to…`
                    : 'Select items above to move'}
                </option>
                {otherBills(bill.id).map((b) => (
                  <option key={b.id} value={b.id}>
                    Bill {bills.indexOf(b) + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      {bills.length === 0 && (
        <p className="text-sm text-text-muted">No folios for this reservation yet.</p>
      )}
    </div>
  );
}
