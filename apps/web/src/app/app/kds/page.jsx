/* apps/web/src/app/app/kds/page.jsx — F4 kitchen display: big-touch board
 * over the F3 QR order stream. New (paid) → Preparing → Served, with recall.
 * Auto-refreshes; built to be read at a glance from across the pass. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../api/client';
import { Loader2, RotateCcw, CheckCheck, ChefHat, ReceiptText } from 'lucide-react';

const fmt = (n) =>
  `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const time = (d) => new Date(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

function Column({ title, icon, list, accent, actions }) {
  return (
    <section className="flex-1 rounded-2xl border border-border bg-surface p-3">
      <h2
        className={`mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${accent}`}
      >
        {icon} {title} <span className="ml-auto text-text-muted">{list.length}</span>
      </h2>
      <div className="space-y-3">
        {list.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-text-muted">
            Nothing here
          </p>
        )}
        {list.map((o) => (
          <article key={o.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-text-muted">{o.reference}</span>
              <span className="text-[11px] text-text-muted">{time(o.createdAt)}</span>
            </div>
            {o.tableLabel && (
              <p className="mt-1 text-xs font-semibold text-text-primary">{o.tableLabel}</p>
            )}
            <ul className="mt-2 space-y-0.5 text-sm text-text-secondary">
              {(o.items ?? []).map((l, i) => (
                <li key={i}>
                  <span className="font-semibold text-text-primary">{l.quantity}×</span> {l.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-muted">{fmt(o.amount)}</p>
            <div className="mt-3 flex gap-2">
              {actions(o).map((a) => (
                <button
                  key={a.label}
                  onClick={() => advance(o, a.status)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${a.className}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function KdsPage() {
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('all'); // all | food | beverage

  const refresh = useCallback(async () => {
    try {
      const r = await apiClient.get('/fnb/staff/orders', { params: { status: 'all' } });
      setOrders(r?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e?.data?.error?.msg ?? 'Board failed to load');
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const board = useMemo(() => {
    const list = (orders ?? []).filter((o) =>
      filter === 'all'
        ? true
        : (o.items ?? []).some((i) => i.category === filter || String(i.name ?? '').length >= 0)
    );
    const byStatus = (s) => list.filter((o) => o.status === s);
    return {
      fresh: byStatus('paid'),
      prepping: byStatus('preparing'),
      done: byStatus('served').slice(0, 12),
    };
  }, [orders, filter]);

  const advance = async (o, status) => {
    try {
      await apiClient.post(`/fnb/staff/orders/${o.id}/status`, { status });
      await refresh();
    } catch (e) {
      setErr(e?.data?.error?.msg);
    }
  };

  if (!orders && !err) {
    return (
      <div className="p-6 text-sm text-text-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading the pass…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-text-primary">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Kitchen Display</h1>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {['all', 'food', 'beverage'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                filter === f ? 'bg-primary text-primary-foreground' : 'text-text-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {err && <span className="text-xs text-danger">{err}</span>}
        <span className="ml-auto text-xs text-text-muted">Auto-refreshes every 4s</span>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        <Column
          title="New"
          icon={<ReceiptText className="h-4 w-4" />}
          accent="text-blue-600"
          list={board.fresh}
          actions={() => [
            {
              label: 'Start preparing',
              status: 'preparing',
              className: 'bg-primary text-primary-foreground',
            },
          ]}
        />
        <Column
          title="Preparing"
          icon={<ChefHat className="h-4 w-4" />}
          accent="text-purple-600"
          list={board.prepping}
          actions={() => [
            { label: 'Served', status: 'served', className: 'bg-emerald-600 text-white' },
            {
              label: 'Cancel',
              status: 'cancelled',
              className: 'border border-danger/40 text-danger',
            },
          ]}
        />
        <Column
          title="Served"
          icon={<CheckCheck className="h-4 w-4" />}
          accent="text-emerald-600"
          list={board.done}
          actions={() => [
            { label: 'Recall', status: 'preparing', className: 'bg-amber-500 text-white' },
          ]}
        />
      </div>
    </div>
  );
}
