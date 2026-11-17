/* apps/web/src/app/app/exceptions/page.v2.jsx
 * Stage 4 - Needs Attention v2 (plan section 8.3). Strangler-gated behind the
 * exceptions.v2 live flag in page.jsx. Server-truthful queue: scoped GET,
 * P12 lifecycle, per-item audited actions, socket-driven refresh. HQ-0 tokens.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '../../../components/patterns/PageShell';
import { TimeAgo } from '../../../components/patterns/TimeAgo';
import {
  listExceptions,
  ackException,
  assignException,
  resolveException,
  dismissException,
} from '../../../api/exceptions';
import { useSocket } from '../../../hooks/useSocket';
import { getAccessToken } from '../../../stores/authStores';

const STATUS_TABS = [
  'active',
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'dismissed',
  'all',
];

const SEV_STYLE = {
  critical: 'border-danger/30 bg-danger/10 text-danger',
  high: 'border-warning/40 bg-warning/10 text-warning',
  medium: 'border-info/30 bg-info/10 text-info',
  low: 'border-border bg-surface-elevated text-text-muted',
};

const familyOf = (k) => String(k || '').split(':')[0] || 'other';

export default function ExceptionsV2Screen() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('active');
  const [sev, setSev] = useState('all');
  const [fam, setFam] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState({});
  const [prompt, setPrompt] = useState(null);
  const [note, setNote] = useState('');

  const q = useQuery({
    queryKey: ['exceptions', status],
    queryFn: () => listExceptions(status),
  });
  const payload = q.data?.data ?? q.data ?? {};
  const items = payload.items ?? [];
  const counts = payload.counts ?? {};

  const families = useMemo(
    () => [...new Set(items.map((i) => familyOf(i.dedupeKey)))].sort(),
    [items]
  );
  const filtered = items.filter(
    (i) => (sev === 'all' || i.severity === sev) && (fam === 'all' || familyOf(i.dedupeKey) === fam)
  );

  const { isConnected, on } = useSocket(getAccessToken());
  useEffect(() => {
    let t = null;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(
        () => qc.invalidateQueries({ predicate: (x) => x.queryKey.includes('exceptions') }),
        400
      );
    };
    on('ops:mutation', handler);
    return () => clearTimeout(t);
  }, [on, qc]);

  const refresh = () =>
    qc.invalidateQueries({ predicate: (x) => x.queryKey.includes('exceptions') });

  const run = async (id, fn) => {
    if (busy[id]) return;
    setBusy((p) => ({ ...p, [id]: true }));
    try {
      await fn();
      refresh();
    } catch {
      /* server message surfaces on refetch; row stays interactive */
    } finally {
      setBusy((p) => ({ ...p, [id]: false }));
    }
  };

  const submitPrompt = async () => {
    const ids = prompt.ids;
    const kind = prompt.kind;
    const text = note.trim();
    setPrompt(null);
    setNote('');
    await Promise.allSettled(
      ids.map((id) =>
        run(id, () =>
          kind === 'resolve' ? resolveException(id, text || undefined) : dismissException(id, text)
        )
      )
    );
    setSelected(new Set());
  };

  const allChecked = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach((i) => next.delete(i.id));
    else filtered.forEach((i) => next.add(i.id));
    setSelected(next);
  };

  const btn = 'rounded-md px-2.5 py-1 hq-text-caption font-medium disabled:opacity-50';

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hq-text-h2 text-text-primary">Needs Attention</h1>
          <p className="hq-text-caption text-text-muted">
            {counts.open ?? 0} open - {counts.acknowledged ?? 0} acknowledged -{' '}
            {counts.in_progress ?? 0} in progress
            <span className={isConnected ? 'text-primary' : 'text-danger'}>
              {' '}
              - {isConnected ? 'Live' : 'Offline'}
            </span>
          </p>
        </div>
        <button
          onClick={() => q.refetch()}
          className="rounded-md border border-border px-3 py-1.5 hq-text-caption text-text-secondary hover:bg-surface-elevated"
        >
          Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={
              'rounded-md border px-2.5 py-1 hq-text-caption capitalize ' +
              (status === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-text-secondary hover:bg-surface-elevated')
            }
          >
            {s.replace('_', ' ')}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <select
          value={sev}
          onChange={(e) => setSev(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 hq-text-caption text-text-secondary"
        >
          <option value="all">All severities</option>
          {['critical', 'high', 'medium', 'low'].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <select
          value={fam}
          onChange={(e) => setFam(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 hq-text-caption text-text-secondary"
        >
          <option value="all">All families</option>
          {families.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2">
          <span className="hq-text-caption text-text-secondary">{selected.size} selected</span>
          <button
            disabled={!!busy.__bulk}
            onClick={() => setPrompt({ kind: 'resolve', ids: [...selected] })}
            className={btn + ' bg-primary text-primary-foreground hover:opacity-90'}
          >
            Resolve
          </button>
          <button
            disabled={!!busy.__bulk}
            onClick={() => setPrompt({ kind: 'dismiss', ids: [...selected] })}
            className={btn + ' border border-border text-text-secondary hover:bg-surface'}
          >
            Dismiss
          </button>
          <button onClick={() => setSelected(new Set())} className={btn + ' text-text-muted'}>
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-b border-border px-3 py-2">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          <span className="hq-text-caption font-medium uppercase tracking-wide text-text-muted">
            {filtered.length} of {items.length} shown
          </span>
          <span className="hq-text-caption text-text-muted">SLA</span>
        </div>
        {q.isLoading ? (
          <p className="px-3 py-8 text-center hq-text-caption text-text-muted">Loading...</p>
        ) : q.isError ? (
          <p className="px-3 py-8 text-center hq-text-caption text-danger">
            Failed to load - try Refresh
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-8 text-center hq-text-caption text-text-muted">
            Nothing needs attention
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((x) => (
              <li
                key={x.id}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={selected.has(x.id)}
                  onChange={() => {
                    const next = new Set(selected);
                    if (next.has(x.id)) next.delete(x.id);
                    else next.add(x.id);
                    setSelected(next);
                  }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        'rounded-full border px-2 py-0.5 hq-text-caption uppercase ' +
                        (SEV_STYLE[x.severity] ?? SEV_STYLE.low)
                      }
                    >
                      {x.severity}
                    </span>
                    {x.overdue && (
                      <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 hq-text-caption text-danger">
                        overdue
                      </span>
                    )}
                    <span className="hq-text-caption text-text-muted">{familyOf(x.dedupeKey)}</span>
                    <span className="hq-text-caption text-text-muted">
                      - {x.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 truncate hq-text-body font-medium text-text-primary">
                    {x.title}
                  </p>
                  <p className="truncate hq-text-caption text-text-secondary">{x.detail}</p>
                  {x.recommendedAction && (
                    <Link
                      to={x.actionUrl || '#'}
                      className="hq-text-caption text-primary hover:underline"
                    >
                      {x.recommendedAction} -&gt;
                    </Link>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {x.slaDueAt && (
                    <TimeAgo date={x.slaDueAt} className="hq-text-caption text-text-muted" />
                  )}
                  <div className="flex gap-1.5">
                    {x.status === 'open' && (
                      <button
                        disabled={!!busy[x.id]}
                        onClick={() => run(x.id, () => ackException(x.id))}
                        className={
                          btn +
                          ' border border-border text-text-secondary hover:bg-surface-elevated'
                        }
                      >
                        Acknowledge
                      </button>
                    )}
                    {['open', 'acknowledged', 'in_progress'].includes(x.status) && (
                      <>
                        <button
                          disabled={!!busy[x.id]}
                          onClick={() => run(x.id, () => assignException(x.id))}
                          className={
                            btn +
                            ' border border-border text-text-secondary hover:bg-surface-elevated'
                          }
                        >
                          Take it
                        </button>
                        <button
                          disabled={!!busy[x.id]}
                          onClick={() => setPrompt({ kind: 'resolve', ids: [x.id] })}
                          className={btn + ' bg-primary text-primary-foreground hover:opacity-90'}
                        >
                          Resolve
                        </button>
                        <button
                          disabled={!!busy[x.id]}
                          onClick={() => setPrompt({ kind: 'dismiss', ids: [x.id] })}
                          className={btn + ' text-text-muted hover:text-danger'}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-md border border-border bg-surface p-4">
            <h2 className="hq-text-h3 text-text-primary capitalize">
              {prompt.kind} {prompt.ids.length > 1 ? prompt.ids.length + ' items' : 'exception'}
            </h2>
            <p className="mt-1 hq-text-caption text-text-muted">
              {prompt.kind === 'dismiss'
                ? 'Dismissal is audited server-side - a reason is required.'
                : 'Optional note for the audit trail.'}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-border bg-background px-2 py-1.5 hq-text-body text-text-primary"
              placeholder={prompt.kind === 'dismiss' ? 'Reason (required)' : 'Note (optional)'}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPrompt(null);
                  setNote('');
                }}
                className={btn + ' border border-border text-text-secondary'}
              >
                Cancel
              </button>
              <button
                disabled={prompt.kind === 'dismiss' && !note.trim()}
                onClick={submitPrompt}
                className={btn + ' bg-primary text-primary-foreground hover:opacity-90'}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
