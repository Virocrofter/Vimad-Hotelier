/* Stage 5 - Housekeeping Office v2 (HQ-0). Strangler-gated behind
 * housekeeping.v2 in page.jsx. Status lens over the three-layer room model;
 * transitions via PATCH /v1/rooms/:id (server-validated, statusEvents audit).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '../../../components/patterns/PageShell';
import Donut from '../../../components/charts/Donut';
import SupervisorBoard from './SupervisorBoard';
import MinibarModal from './MinibarModal';
import { api } from '../../../api/client';
import { useSocket } from '../../../hooks/useSocket';
import { getAccessToken } from '../../../stores/authStores';

const HK_STATES = ['dirty', 'in_progress', 'clean', 'inspected', 'ready'];
const SVC_STATES = ['active', 'ooo', 'oos'];
const label = (s) => String(s ?? '').replace(/_/g, ' ');

const HK_STYLE = {
  ready: 'border-primary/40 bg-primary/10 text-primary',
  clean: 'border-primary/40 bg-primary/10 text-primary',
  inspected: 'border-primary bg-primary text-primary-foreground',
  dirty: 'border-warning/40 bg-warning/10 text-warning',
  in_progress: 'border-info/40 bg-info/10 text-info',
  ooo: 'border-danger/40 bg-danger/10 text-danger',
  oos: 'border-border bg-surface-elevated text-text-muted',
  active: 'border-border bg-surface-elevated text-text-muted',
};

function firstPropertyId(payload) {
  const d = payload?.data ?? payload ?? {};
  const arr = Array.isArray(d) ? d : (d.items ?? d.properties ?? []);
  const p = arr.find((x) => x && (x.status === 'active' || !x.status)) ?? arr[0];
  return p?.id ?? '';
}

export default function HousekeepingV2Screen() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState({});
  const [minibarOpen, setMinibarOpen] = useState(false);

  const propQ = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/v1/properties'),
    staleTime: 60000,
  });
  const propertyId = firstPropertyId(propQ.data);

  const roomsQ = useQuery({
    queryKey: ['hk-rooms', propertyId],
    enabled: !!propertyId,
    queryFn: () => api.get('/v1/rooms', { params: { propertyId, pageSize: 200 } }),
  });
  const payload = roomsQ.data?.data ?? roomsQ.data ?? {};
  const rooms = useMemo(
    () => (Array.isArray(payload) ? payload : (payload.items ?? payload.rooms ?? [])),
    [payload]
  );

  const counts = useMemo(() => {
    const c = {};
    for (const r of rooms) {
      const k = r.housekeepingStatus ?? 'clean';
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [rooms]);

  const floors = useMemo(() => {
    const m = new Map();
    for (const r of rooms) {
      const f = r.floor || 'No floor';
      if (!m.has(f)) m.set(f, []);
      m.get(f).push(r);
    }
    for (const arr of m.values())
      arr.sort((a, b) => String(a.number).localeCompare(String(b.number)));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rooms]);

  const { isConnected, on } = useSocket(getAccessToken());
  useEffect(() => {
    let t = null;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(
        () => qc.invalidateQueries({ predicate: (q) => q.queryKey.includes('hk-rooms') }),
        400
      );
    };
    on('ops:mutation', handler);
    return () => clearTimeout(t);
  }, [on, qc]);

  const transition = async (room, patch) => {
    const key = room.id;
    if (busy[key]) return;
    setBusy((p) => ({ ...p, [key]: true }));
    try {
      await api.patch('/v1/rooms/' + room.id, patch);
      qc.invalidateQueries({ queryKey: ['hk-rooms', propertyId] });
    } catch {
      /* server truth on refetch */
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
    }
  };

  const sel = rooms.find((r) => r.id === selected) ?? null;
  const btn = 'rounded-md px-2.5 py-1 hq-text-caption font-medium capitalize disabled:opacity-50';

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hq-text-h2 text-text-primary">Housekeeping</h1>
          <p className="hq-text-caption text-text-muted">
            {rooms.length} rooms · {counts.ready ?? counts.clean ?? 0} ready · {counts.dirty ?? 0}{' '}
            dirty · {counts.in_progress ?? 0} in progress
            <span className={isConnected ? 'text-primary' : 'text-danger'}>
              {' '}
              - {isConnected ? 'Live' : 'Offline'}
            </span>
          </p>
        </div>
        <button
          onClick={() => setMinibarOpen(true)}
          className="rounded-md border border-border px-3 py-1.5 hq-text-caption text-text-secondary hover:bg-surface-elevated"
        >
          Log minibar
        </button>
        <button
          onClick={() => roomsQ.refetch()}
          className="rounded-md border border-border px-3 py-1.5 hq-text-caption text-text-secondary hover:bg-surface-elevated"
        >
          Refresh
        </button>
      </div>

      <div className="mb-4 flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3">
        <Donut
          size={112}
          center="rooms"
          segments={Object.entries(counts).map(([k, v]) => ({
            label: label(k),
            value: v,
            tone: k,
          }))}
        />
        <p className="hq-text-caption text-text-muted">
          Housekeeping mix - click a room to transition
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(counts).map(([k, v]) => (
          <span
            key={k}
            className={
              'rounded-full border px-2.5 py-0.5 hq-text-caption capitalize ' +
              (HK_STYLE[k] ?? HK_STYLE.active)
            }
          >
            {label(k)} {v}
          </span>
        ))}
      </div>

      {sel && (
        <div className="mb-4 rounded-md border border-border bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hq-text-body font-medium text-text-primary">Room {sel.number}</span>
            <span className="hq-text-caption text-text-muted">housekeeping:</span>
            {HK_STATES.map((s) => (
              <button
                key={s}
                disabled={!!busy[sel.id]}
                onClick={() => transition(sel, { housekeepingStatus: s })}
                className={
                  btn +
                  ' ' +
                  ((sel.housekeepingStatus ?? 'clean') === s
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-text-secondary hover:bg-surface-elevated')
                }
              >
                {label(s)}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" />
            <span className="hq-text-caption text-text-muted">service:</span>
            {SVC_STATES.map((s) => (
              <button
                key={s}
                disabled={!!busy[sel.id]}
                onClick={() => transition(sel, { status: s === 'active' ? 'clean' : s })}
                className={
                  btn +
                  ' ' +
                  ((sel.status ?? 'clean') === s
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-text-secondary hover:bg-surface-elevated')
                }
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {floors.map(([floor, arr]) => (
          <div key={floor}>
            <p className="mb-1.5 hq-text-caption font-medium uppercase tracking-wide text-text-muted">
              {floor}
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {arr.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id === selected ? null : r.id)}
                  className={
                    'rounded-md border px-2 py-2 text-left ' +
                    (r.id === selected ? 'border-primary' : 'border-border') +
                    ' bg-surface hover:bg-surface-elevated'
                  }
                >
                  <p className="hq-text-body font-medium text-text-primary">{r.number}</p>
                  <span
                    className={
                      'mt-1 inline-block rounded-full border px-1.5 py-0.5 hq-text-caption capitalize ' +
                      (HK_STYLE[r.housekeepingStatus ?? 'clean'] ?? HK_STYLE.active)
                    }
                  >
                    {label(r.housekeepingStatus ?? 'clean')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {roomsQ.isLoading && (
        <p className="mt-6 text-center hq-text-caption text-text-muted">Loading rooms…</p>
      )}
      {!roomsQ.isLoading && rooms.length === 0 && (
        <p className="mt-6 text-center hq-text-caption text-text-muted">
          No rooms for this property yet
        </p>
      )}
      <div className="mt-6">
        <SupervisorBoard />
      </div>
      <MinibarModal open={minibarOpen} onClose={() => setMinibarOpen(false)} />
    </PageShell>
  );
}
