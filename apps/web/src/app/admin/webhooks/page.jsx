/* src/app/admin/webhooks/page.jsx
 * Fleet Webhook Delivery & Replay Center (Phase 3, blueprint Pillar 5 Tab 2).
 * Cross-tenant view over the delivery engine (webhookDispatch): failed
 * deliveries surface first, one-click replay re-queues through the SAME
 * HMAC-signed pipeline the engine uses. */
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Webhook, X } from 'lucide-react';
import {
  getFleetDelivery,
  getWebhookStats,
  listFleetDeliveries,
  replayFleetDelivery,
} from '@/api/adminTenants';

const STATUS_CLS = {
  delivered: 'border-accent/30 bg-accent/10 text-accent',
  pending: 'border-info/30 bg-info/10 text-info',
  failed: 'border-danger/30 bg-danger/10 text-danger',
};

const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-ZA', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default function WebhooksPage() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('failed');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const notify = (msg, isErr) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, s] = await Promise.all([
        listFleetDeliveries({ status: statusFilter, page: String(page), pageSize: '25' }),
        getWebhookStats(),
      ]);
      setData(d);
      setStats(s);
    } catch (e) {
      setError(e.message);
      setData({ items: [], total: 0 });
    }
  }, [statusFilter, page]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const openDetail = async (row) => {
    try {
      setDetail(await getFleetDelivery(row.id));
    } catch (e) {
      notify(e.message, true);
    }
  };

  const replay = async (row) => {
    if (!window.confirm('Replay this delivery through the signing pipeline?')) return;
    setBusy(true);
    try {
      await replayFleetDelivery(row.id);
      notify('Replay queued');
      await load();
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
            <Webhook className="h-6 w-6" /> Webhook Deliveries
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Fleet-wide delivery log — every tenant, every endpoint, replay in one click.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text-primary hover:bg-surface-elevated"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { l: 'Delivered (24h)', v: stats.byStatus?.delivered ?? 0, cls: 'text-accent' },
            { l: 'Pending retry', v: stats.byStatus?.pending ?? 0, cls: 'text-info' },
            { l: 'Failed (24h)', v: stats.byStatus?.failed ?? 0, cls: 'text-danger' },
            { l: 'Retry due now', v: stats.pendingRetry ?? 0, cls: 'text-warning' },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">{k.l}</p>
              <p className={'mt-1 text-2xl font-bold tabular-nums ' + k.cls}>{k.v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="failed">Failed</option>
          <option value="pending">Pending retry</option>
          <option value="delivered">Delivered</option>
          <option value="">All statuses</option>
        </select>
        <span className="text-sm text-text-muted">
          {data ? `${data.total} deliveries` : 'Loading…'}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {error && <div className="p-6 text-sm text-danger">Could not load: {error}</div>}
        {!error && data === null && <div className="p-6 text-sm text-text-muted">Loading…</div>}
        {!error && data !== null && data.items.length === 0 && (
          <div className="p-12 text-center text-text-muted">
            <Webhook className="mx-auto mb-3 h-10 w-10" />
            No {statusFilter || ''} deliveries. Webhooks fire when tenants have active endpoints.
          </div>
        )}
        {!error && data !== null && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Tenant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Attempts
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Code
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer transition-colors hover:bg-background/50"
                    onClick={() => openDetail(r)}
                  >
                    <td className="px-4 py-3 text-text-secondary">{fmtTime(r.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{r.tenantName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{r.event}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-text-muted">
                      {r.endpointUrl}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex rounded-full border px-2 py-0.5 text-xs ' +
                          (STATUS_CLS[r.status] ?? STATUS_CLS.pending)
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-primary">{r.attempts}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">
                      {r.statusCode ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => replay(r)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-accent/30 px-3 text-xs text-accent hover:bg-accent/10"
                      >
                        <RotateCcw className="h-3 w-3" /> Replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>
          Page {data?.page ?? 1} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="h-8 rounded-md border border-border px-3 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="h-8 rounded-md border border-border px-3 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          />
          <div className="relative w-full max-w-lg overflow-auto bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/80 px-6 py-4 backdrop-blur-md">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Delivery detail</h2>
                <p className="font-mono text-xs text-text-muted">{detail.id}</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-elevated"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {[
                ['Tenant', detail.tenantName],
                ['Event', detail.event],
                ['Endpoint', detail.endpoint?.url ?? '—'],
                ['Status', `${detail.status} · ${detail.attempts} attempt(s)`],
                ['Status code', detail.statusCode ?? '—'],
                ['Duration', detail.durationMs != null ? detail.durationMs + ' ms' : '—'],
                ['Last error', detail.lastError ?? '—'],
                ['Delivered at', fmtTime(detail.deliveredAt)],
                ['Queued at', fmtTime(detail.createdAt)],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm"
                >
                  <span className="text-text-secondary">{k}</span>
                  <span className="break-all text-right font-mono text-text-primary">{v}</span>
                </div>
              ))}
              <div>
                <p className="mb-2 text-sm font-medium text-text-primary">Payload</p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs text-text-secondary">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={
            'fixed bottom-4 right-4 rounded-lg border px-4 py-2 text-sm ' +
            (toast.isErr
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-accent/30 bg-accent/10 text-accent')
          }
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
