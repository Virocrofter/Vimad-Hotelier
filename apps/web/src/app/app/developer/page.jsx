/* apps/web/src/app/app/developer/page.jsx — D1+ developer webhooks portal.
 * Owner/admin only (server-enforced): register endpoints, capture the
 * one-time signing secret, watch deliveries, replay failures, fire tests. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';

const friendly = (e) =>
  e?.data?.error?.code === 'FORBIDDEN'
    ? 'Owner/admin roles only — your role cannot manage webhooks.'
    : (e?.data?.error?.msg ?? e?.data?.error?.code ?? 'Request failed');

const STATUS_BADGE = {
  delivered: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
};

export default function DeveloperWebhooksPage() {
  const [endpoints, setEndpoints] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({
    url: '',
    events: 'reservation.checked_in, reservation.checked_out',
  });
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState({});
  const [selected, setSelected] = useState(null);
  const [deliveries, setDeliveries] = useState(null);
  const pollRef = useRef(null);

  const loadEndpoints = useCallback(async () => {
    try {
      const r = await apiClient.get('/webhooks');
      setEndpoints(r?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(friendly(e));
      setEndpoints([]);
    }
  }, []);

  const loadDeliveries = useCallback(async (endpointId) => {
    if (!endpointId) {
      setDeliveries(null);
      return;
    }
    try {
      const r = await apiClient.get('/webhooks/deliveries', {
        params: { endpointId, pageSize: 50 },
      });
      setDeliveries(r?.data?.data?.items ?? []);
    } catch {
      setDeliveries([]);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadEndpoints);
  }, [loadEndpoints]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    loadDeliveries(selected);
    if (selected) {
      pollRef.current = setInterval(() => loadDeliveries(selected), 5000);
    }
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [selected, loadDeliveries]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast({ title: okMsg });
      await loadEndpoints();
      if (selected) await loadDeliveries(selected);
      return true;
    } catch (e) {
      toast({ title: 'Failed', description: friendly(e), variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    act(async () => {
      const events = form.events
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const r = await apiClient.post('/webhooks', { url: form.url.trim(), events });
      const d = r?.data?.data;
      if (d?.secret && d?.endpoint?.id) {
        setRevealed((m) => ({ ...m, [d.endpoint.id]: d.secret }));
      }
      setForm({ url: '', events: form.events });
    });

  const rotate = (id) =>
    act(async () => {
      const r = await apiClient.post(`/webhooks/${id}/rotate`);
      const secret = r?.data?.data?.secret;
      if (secret) setRevealed((m) => ({ ...m, [id]: secret }));
    }, 'Secret rotated — old signature valid for 24h');

  const toggle = (ep) =>
    act(
      async () => {
        await apiClient.patch(`/webhooks/${ep.id}`, {
          status: ep.status === 'active' ? 'paused' : 'active',
        });
      },
      ep.status === 'active' ? 'Endpoint paused' : 'Endpoint resumed'
    );

  const remove = (id) =>
    act(async () => {
      await apiClient.delete(`/webhooks/${id}`);
      if (selected === id) setSelected(null);
    }, 'Endpoint deleted');

  const test = (id) =>
    act(async () => {
      await apiClient.post(`/webhooks/test/${id}`);
    }, 'Test event sent');

  const replay = (id) =>
    act(async () => {
      await apiClient.post(`/webhooks/deliveries/${id}/replay`);
    }, 'Delivery replayed');

  const copy = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    toast({ title: 'Secret copied' });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Developer Webhooks</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Signed, retried, observable HTTP callbacks for this property. Payloads are HMAC-SHA256
          signed — verify with the X-Vimad-Signature header.
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary">
          {err}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text-primary">Register endpoint</h2>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://your-server.example.com/vimad-webhook"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <input
            value={form.events}
            onChange={(e) => setForm({ ...form, events: e.target.value })}
            placeholder="events, comma separated (* for all)"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          />
          <button
            onClick={create}
            disabled={busy || !form.url.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {(endpoints ?? []).map((ep) => (
          <div key={ep.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-text-primary">{ep.url}</p>
                <p className="mt-0.5 text-xs text-text-muted">{(ep.events ?? []).join(', ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    ep.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {ep.status}
                </span>
                <button
                  onClick={() => test(ep.id)}
                  disabled={busy}
                  className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
                >
                  Test
                </button>
                <button
                  onClick={() => toggle(ep)}
                  disabled={busy}
                  className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
                >
                  {ep.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => rotate(ep.id)}
                  disabled={busy}
                  className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
                >
                  Rotate secret
                </button>
                <button
                  onClick={() => (selected === ep.id ? setSelected(null) : setSelected(ep.id))}
                  className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
                >
                  {selected === ep.id ? 'Hide deliveries' : 'Deliveries'}
                </button>
                <button
                  onClick={() => remove(ep.id)}
                  disabled={busy}
                  className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  Delete
                </button>
              </div>
            </div>

            {revealed[ep.id] && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                <p className="text-xs text-text-secondary">
                  Signing secret (shown once — store it now):
                </p>
                <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs text-text-primary">
                  {revealed[ep.id]}
                </code>
                <button
                  onClick={() => copy(revealed[ep.id])}
                  className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-elevated"
                >
                  Copy
                </button>
              </div>
            )}

            {selected === ep.id && (
              <div className="mt-3 border-t border-border pt-3">
                {deliveries === null ? (
                  <p className="text-xs text-text-muted">Loading deliveries…</p>
                ) : deliveries.length === 0 ? (
                  <p className="text-xs text-text-muted">No deliveries yet — fire a Test.</p>
                ) : (
                  <div className="space-y-1.5">
                    {deliveries.map((d) => (
                      <div
                        key={d.id}
                        className="flex flex-wrap items-center gap-2 text-xs text-text-secondary"
                      >
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_BADGE[d.status] ?? 'bg-gray-200 text-gray-700'}`}
                        >
                          {d.status}
                        </span>
                        <span className="font-mono">{d.event}</span>
                        <span>attempts {d.attempts}</span>
                        {d.statusCode != null && <span>HTTP {d.statusCode}</span>}
                        {d.durationMs != null && <span>{d.durationMs}ms</span>}
                        {d.lastError && <span className="text-danger">{d.lastError}</span>}
                        {d.nextRetryAt && (
                          <span>next {new Date(d.nextRetryAt).toLocaleTimeString()}</span>
                        )}
                        {d.deliveredAt && (
                          <span>{new Date(d.deliveredAt).toLocaleTimeString()}</span>
                        )}
                        {(d.status === 'failed' || d.status === 'pending') && (
                          <button
                            onClick={() => replay(d.id)}
                            disabled={busy}
                            className="rounded border border-border px-2 py-0.5 hover:bg-surface-elevated"
                          >
                            Replay
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {endpoints && endpoints.length === 0 && !err && (
          <p className="text-sm text-text-muted">No endpoints yet — register your first above.</p>
        )}
      </div>
    </div>
  );
}
