/* apps/web/src/app/app/fnb/page.jsx — F3 staff surface: live order queue,
 * status transitions, refunds, and the printable QR card. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProperties } from '../../../hooks/useProperties';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';
import { Loader2, Printer, QrCode, RefreshCw } from 'lucide-react';

const STATUS_TONE = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  served: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-700',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
};

export default function FnbStaffPage() {
  const { properties } = useProperties();
  const property = properties?.[0];
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState(null);
  const [lens, setLens] = useState('active');

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stable refresh identity drives the polling effect
  const refresh = useCallback(async () => {
    try {
      const r = await apiClient.get('/fnb/staff/orders', {
        params: property?.id ? { propertyId: property.id } : {},
      });
      setOrders(r?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e?.data?.error?.msg ?? 'Order queue failed to load');
    }
  }, [property?.id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  const visible = useMemo(() => {
    if (!orders) return [];
    if (lens === 'active')
      return orders.filter((o) => ['pending', 'paid', 'preparing'].includes(o.status));
    return orders;
  }, [orders, lens]);

  const act = async (id, action, body = {}) => {
    try {
      await apiClient.post(`/fnb/staff/orders/${id}/${action}`, body);
      toast({ title: 'Updated' });
      await refresh();
    } catch (e) {
      toast({ title: 'Failed', description: e?.data?.error?.msg, variant: 'destructive' });
    }
  };

  const menuUrl = property?.code ? `${window.location.origin}/fnb/${property.code}` : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">F&B Orders</h1>
          <p className="mt-1 text-sm text-text-secondary">
            QR orders arrive here the moment guests pay.
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
        >
          <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {menuUrl && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(menuUrl)}`}
            alt="Order QR"
            className="h-28 w-28 rounded-md border border-border"
          />
          <div className="min-w-52 flex-1">
            <p className="text-sm font-semibold text-text-primary">
              Guest QR — print & place on tables
            </p>
            <p className="mt-0.5 break-all text-xs text-text-muted">{menuUrl}</p>
            <p className="mt-1 text-[11px] text-text-muted">
              Add <code>?table=Pool-deck</code> per zone when printing zone-specific codes.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white"
          >
            <Printer className="mr-1 inline h-4 w-4" /> Print
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {['active', 'all'].map((l) => (
          <button
            key={l}
            onClick={() => setLens(l)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              lens === l
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            {l === 'active' ? 'Active' : 'All'}
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}
      {!orders && !err && <p className="text-sm text-text-muted">Loading…</p>}
      {orders && visible.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          <QrCode className="mx-auto mb-2 h-6 w-6" />
          No orders yet — when a guest scans the QR and pays, the order lands here instantly.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((o) => (
          <div key={o.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[o.status]}`}
              >
                {o.status}
              </span>
              <span className="font-mono text-xs text-text-muted">{o.reference}</span>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-text-secondary">
              {(o.items ?? []).map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {l.quantity} × {l.name}
                  </span>
                  <span>R {Number(l.lineTotal).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold text-text-primary">
                <span>Total</span>
                <span>R {Number(o.amount).toFixed(2)}</span>
              </div>
              {o.tableLabel && <p className="pt-1 text-text-muted">Table: {o.tableLabel}</p>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {o.status === 'paid' && (
                <button
                  onClick={() => act(o.id, 'status', { status: 'preparing' })}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  Start preparing
                </button>
              )}
              {o.status === 'preparing' && (
                <button
                  onClick={() => act(o.id, 'status', { status: 'served' })}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Mark served
                </button>
              )}
              {(o.status === 'pending' || o.status === 'paid' || o.status === 'preparing') && (
                <button
                  onClick={() => act(o.id, 'status', { status: 'cancelled' })}
                  className="rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger"
                >
                  Cancel
                </button>
              )}
              {o.status === 'paid' && (
                <button
                  onClick={() => act(o.id, 'refund', { reason: 'Guest request' })}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
                >
                  Refund
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
