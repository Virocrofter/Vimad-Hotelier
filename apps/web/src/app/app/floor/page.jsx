/* apps/web/src/app/app/floor/page.jsx — F1/F2 floor plan: venue tables by
 * area, tap-to-seat (opens a till check in one action), dining walk, free.
 * Reads the pinned p55 tables + p54 till endpoints. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProperties } from '../../../hooks/useProperties';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';
import { Loader2, Plus, RefreshCw, UtensilsCrossed } from 'lucide-react';

const TONE = {
  free: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700',
  seated: 'border-blue-500/50 bg-blue-500/10 text-blue-700',
  ordered: 'border-amber-500/50 bg-amber-500/10 text-amber-700',
  served: 'border-purple-500/50 bg-purple-500/10 text-purple-700',
};

export default function FloorPage() {
  const { properties } = useProperties();
  const property = properties?.[0];
  const [tables, setTables] = useState(null);
  const [checks, setChecks] = useState([]);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', area: '', seats: '' });

  const refresh = useCallback(async () => {
    if (!property?.id) return;
    try {
      const [t, c] = await Promise.all([
        apiClient.get('/fnb/tables', { params: { propertyId: property.id } }),
        apiClient.get('/till/checks', { params: { propertyId: property.id, status: 'open' } }),
      ]);
      setTables(t?.data?.data ?? []);
      setChecks(c?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e?.data?.error?.msg ?? 'Floor failed to load');
    }
  }, [property?.id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast({ title: ok });
      await refresh();
    } catch (e) {
      toast({ title: 'Failed', description: e?.data?.error?.msg, variant: 'destructive' });
    }
  };

  const seat = async (table) => {
    act(async () => {
      const c = await apiClient.post('/till/checks', {
        propertyId: property.id,
        label: table.label,
      });
      await apiClient.post(`/fnb/tables/${table.id}/seat`, {
        checkId: c?.data?.data?.id ?? c?.data?.id,
      });
    }, `${table.label} seated`);
  };

  const createTable = async () => {
    act(async () => {
      await apiClient.post('/fnb/tables', {
        propertyId: property.id,
        label: form.label.trim(),
        area: form.area.trim() || undefined,
        seats: form.seats ? Number(form.seats) : undefined,
      });
      setForm({ label: '', area: '', seats: '' });
      setAdding(false);
    }, 'Table added');
  };

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of tables ?? []) {
      const key = t.area ?? 'Main';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tables]);

  if (!property) {
    return (
      <div className="p-6 text-sm text-text-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading property…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Floor Plan</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Tap a free table to seat a new check · tap a busy one to advance or free it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
          >
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={() => setAdding(!adding)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add table
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      {adding && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4">
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Label (T1)"
            className="h-9 w-28 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            placeholder="Area (Deck)"
            className="h-9 w-32 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            value={form.seats}
            onChange={(e) => setForm({ ...form, seats: e.target.value })}
            placeholder="Seats"
            type="number"
            min="1"
            className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm"
          />
          <button
            onClick={createTable}
            disabled={!form.label.trim()}
            className="h-9 rounded-md bg-secondary px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {!tables && <p className="text-sm text-text-muted">Loading…</p>}
      {tables && tables.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          No tables yet — add your floor so the till can bind checks to seats.
        </p>
      )}

      {groups.map(([area, list]) => (
        <section key={area}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">{area}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {list.map((t) => (
              <div key={t.id} className={`rounded-xl border p-4 ${TONE[t.status] ?? TONE.free}`}>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{t.label}</span>
                  {t.seats && <span className="text-[11px] opacity-70">{t.seats} seats</span>}
                </div>
                <p className="mt-1 text-[11px] capitalize opacity-80">{t.status}</p>
                <div className="mt-3">
                  {t.status === 'free' ? (
                    <button
                      onClick={() => seat(t)}
                      className="w-full rounded-lg bg-background/80 py-1.5 text-xs font-semibold text-text-primary hover:bg-background"
                    >
                      Seat
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      {t.status === 'seated' && (
                        <button
                          onClick={() =>
                            act(
                              () =>
                                apiClient.post(`/fnb/tables/${t.id}/status`, { status: 'ordered' }),
                              'Order fired'
                            )
                          }
                          className="flex-1 rounded-lg bg-background/80 py-1.5 text-xs font-semibold text-text-primary hover:bg-background"
                        >
                          Ordered
                        </button>
                      )}
                      {t.status === 'ordered' && (
                        <button
                          onClick={() =>
                            act(
                              () =>
                                apiClient.post(`/fnb/tables/${t.id}/status`, { status: 'served' }),
                              'Served'
                            )
                          }
                          className="flex-1 rounded-lg bg-background/80 py-1.5 text-xs font-semibold text-text-primary hover:bg-background"
                        >
                          Served
                        </button>
                      )}
                      {t.status === 'served' && (
                        <button
                          onClick={() =>
                            act(
                              () => apiClient.post(`/fnb/tables/${t.id}/free`),
                              `${t.label} freed`
                            )
                          }
                          className="flex-1 rounded-lg bg-background/80 py-1.5 text-xs font-semibold text-text-primary hover:bg-background"
                        >
                          Free
                        </button>
                      )}
                      <button
                        onClick={() =>
                          act(() => apiClient.post(`/fnb/tables/${t.id}/free`), `${t.label} freed`)
                        }
                        title="Free without serving"
                        className="rounded-lg bg-background/60 px-2 py-1.5 text-[11px] text-text-muted hover:bg-background"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                {t.checkId && (
                  <p className="mt-2 flex items-center gap-1 text-[10px] opacity-70">
                    <UtensilsCrossed className="h-3 w-3" />{' '}
                    {checks.find((c) => c.id === t.checkId)?.label ?? 'check open'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
