/* apps/web/src/app/app/automations/page.jsx — Phase 13 UI: workflow builder
 * (structured forms), manual fire, run log with the execution-trace viewer,
 * storage. Rides the pinned p58 engine. */
import { useCallback, useEffect, useState } from 'react';
import { useProperties } from '../../../hooks/useProperties';
import { apiClient } from '../../../api/client';
import { toast } from '../../../hooks/use-toast';
import {
  Loader2,
  RefreshCw,
  Play,
  ChevronDown,
  ChevronRight,
  Zap,
  Database,
  Filter,
  Timer,
  Send,
} from 'lucide-react';

const STATUS_TONE = {
  completed: 'bg-emerald-100 text-emerald-800',
  skipped: 'bg-gray-200 text-gray-700',
  waiting: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
};

const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists', 'truthy'];

export default function AutomationsPage() {
  const { properties } = useProperties();
  const property = properties?.[0];
  const [workflows, setWorkflows] = useState(null);
  const [runs, setRuns] = useState([]);
  const [err, setErr] = useState(null);
  const [building, setBuilding] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [trace, setTrace] = useState({});
  const [firing, setFiring] = useState(null);
  const [storage, setStorage] = useState({ key: '', value: '' });

  const refresh = useCallback(async () => {
    try {
      const [w, r] = await Promise.all([
        apiClient.get('/automations/workflows'),
        apiClient.get('/automations/runs'),
      ]);
      setWorkflows(w?.data?.data ?? []);
      setRuns(r?.data?.data ?? []);
      setErr(null);
    } catch (e) {
      setErr(e?.data?.error?.msg ?? 'Automations failed to load');
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(refresh);
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const loadTrace = async (run) => {
    if (expanded === run.id) {
      setExpanded(null);
      return;
    }
    setExpanded(run.id);
    if (!trace[run.id]) {
      const r = await apiClient.get(`/automations/runs/${run.id}`);
      setTrace((t) => ({ ...t, [run.id]: r?.data?.data?.executionTrace ?? [] }));
    }
  };

  const fire = async () => {
    try {
      const payload = firing.payload.trim() ? JSON.parse(firing.payload) : {};
      const r = await apiClient.post(`/automations/workflows/${firing.id}/fire`, { payload });
      toast({ title: `Fired — run ${r?.data?.runs?.[0]?.status ?? 'started'}` });
      setFiring(null);
      await refresh();
    } catch (e) {
      toast({
        title: 'Fire failed',
        description: e?.data?.error?.msg ?? 'Invalid payload JSON',
        variant: 'destructive',
      });
    }
  };

  const saveStorage = async () => {
    try {
      await apiClient.put(`/automations/storage/${encodeURIComponent(storage.key.trim())}`, {
        value: storage.value.trim() ? JSON.parse(storage.value) : null,
      });
      toast({ title: 'Storage saved' });
      setStorage({ key: '', value: '' });
    } catch {
      toast({ title: 'Invalid JSON', variant: 'destructive' });
    }
  };

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
          <h1 className="text-2xl font-bold text-text-primary">Automations</h1>
          <p className="mt-1 text-sm text-text-secondary">
            When something happens, do these steps — every run keeps an execution trace.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
          >
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={() => setBuilding(!building)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Zap className="h-4 w-4" /> New workflow
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}
      {building && (
        <Builder
          property={property}
          onDone={() => {
            setBuilding(false);
            refresh();
          }}
        />
      )}

      {!workflows && <p className="text-sm text-text-muted">Loading…</p>}
      {workflows && workflows.length === 0 && !building && (
        <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          No workflows yet — build one and fire it manually to watch the trace.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {workflows?.map((w) => (
          <div key={w.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-text-primary">{w.name}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  w.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {w.triggerType}
                {w.eventKey ? ` · ${w.eventKey}` : ''}
                {w.cronMinutes ? ` · ${w.cronMinutes}m` : ''}
              </span>
            </div>
            {w.description && <p className="mt-1 text-xs text-text-muted">{w.description}</p>}
            <ol className="mt-2 space-y-1 text-xs text-text-secondary">
              {w.steps.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  {s.type === 'condition' ? (
                    <Filter className="h-3 w-3" />
                  ) : s.type === 'delay' ? (
                    <Timer className="h-3 w-3" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  <span className="capitalize">{s.type}</span>
                  <span className="text-text-muted">
                    {s.type === 'action' ? `· ${s.config.type}` : ''}
                    {s.type === 'delay' ? `· ${s.config.minutes}m` : ''}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <button
                onClick={() => setFiring({ id: w.id, name: w.name, payload: '' })}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-white"
              >
                <Play className="h-3 w-3" /> Fire
              </button>
              <span className="ml-auto text-[11px] text-text-muted">
                {runs.filter((r) => r.workflowId === w.id).length} runs
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Run log */}
      {runs.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-text-muted">
            Run log
          </h2>
          <div className="space-y-1.5">
            {runs.slice(0, 20).map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface">
                <button
                  onClick={() => loadTrace(r)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  {expanded === r.id ? (
                    <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status]}`}
                  >
                    {r.status}
                  </span>
                  <span className="text-xs text-text-muted">
                    {workflows?.find((w) => w.id === r.workflowId)?.name ?? r.workflowId}
                  </span>
                  <span className="ml-auto text-[11px] text-text-muted">
                    {new Date(r.startedAt).toLocaleString('en-ZA')}
                  </span>
                </button>
                {expanded === r.id && (
                  <div className="border-t border-border px-6 py-3">
                    <Trace entries={trace[r.id] ?? []} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Storage */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-text-primary">
          <Database className="h-4 w-4" /> Storage
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={storage.key}
            onChange={(e) => setStorage({ ...storage, key: e.target.value })}
            placeholder="key"
            className="h-9 w-48 rounded-md border border-border bg-background px-3 font-mono text-xs"
          />
          <input
            value={storage.value}
            onChange={(e) => setStorage({ ...storage, value: e.target.value })}
            placeholder='{"any":"json"}'
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-xs"
          />
          <button
            onClick={saveStorage}
            disabled={!storage.key.trim()}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </section>

      {firing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Fire — {firing.name}</h2>
              <button onClick={() => setFiring(null)} className="text-text-muted">
                ✕
              </button>
            </div>
            <textarea
              value={firing.payload}
              onChange={(e) => setFiring({ ...firing, payload: e.target.value })}
              placeholder='{"vip":true,"guestName":"Test"}'
              rows={5}
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
            />
            <button
              onClick={fire}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            >
              <Play className="h-4 w-4" /> Fire now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Trace({ entries }) {
  if (!entries?.length) return <p className="text-xs text-text-muted">No trace yet.</p>;
  return (
    <ol className="space-y-1.5">
      {entries.map((e, i) => (
        <li key={i} className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
            {e.type}
          </span>
          <span className="text-text-secondary">{e.detail}</span>
          <span className="ml-auto shrink-0 text-[10px] text-text-muted">
            {new Date(e.at).toLocaleTimeString('en-ZA')}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Builder({ property, onDone }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'manual',
    eventKey: '',
    cronMinutes: '',
    steps: [{ type: 'condition', config: { all: [{ field: '', op: 'eq', value: '' }] } }],
  });
  const [busy, setBusy] = useState(false);

  const setStep = (i, next) =>
    setForm({ ...form, steps: form.steps.map((s, j) => (j === i ? next : s)) });

  const addStep = (type) => {
    const blank =
      type === 'condition'
        ? { type, config: { all: [{ field: '', op: 'eq', value: '' }] } }
        : type === 'delay'
          ? { type, config: { minutes: 5 } }
          : {
              type,
              config: {
                type: 'create_task',
                propertyId: property.id,
                department: 'management',
                title: 'Task',
              },
            };
    setForm({ ...form, steps: [...form.steps, blank] });
  };

  const save = async () => {
    setBusy(true);
    try {
      const steps = form.steps.map((s) => {
        if (s.type === 'condition') {
          return {
            type: 'condition',
            config: {
              all: s.config.all
                .filter((c) => c.field.trim())
                .map((c) => ({
                  field: c.field.trim(),
                  op: c.op,
                  ...(c.op !== 'exists' && c.op !== 'truthy' ? { value: coerce(c.value) } : {}),
                })),
            },
          };
        }
        if (s.type === 'delay')
          return { type: 'delay', config: { minutes: Number(s.config.minutes) || 0 } };
        const cfg = { ...s.config };
        if (cfg.type === 'folio_item') {
          cfg.quantity = Number(cfg.quantity) || 1;
        }
        return { type: 'action', config: cfg };
      });
      await apiClient.post('/automations/workflows', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        triggerType: form.triggerType,
        eventKey: form.triggerType === 'event' ? form.eventKey.trim() : undefined,
        cronMinutes: form.triggerType === 'cron' ? Number(form.cronMinutes) : undefined,
        propertyId: property.id,
        steps,
      });
      toast({ title: 'Workflow created' });
      onDone();
    } catch (e) {
      toast({ title: 'Save failed', description: e?.data?.error?.msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const coerce = (v) => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
    return v;
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Workflow name"
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <select
          value={form.triggerType}
          onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="manual">Manual</option>
          <option value="event">Event</option>
          <option value="cron">Cron</option>
        </select>
        {form.triggerType === 'event' && (
          <input
            value={form.eventKey}
            onChange={(e) => setForm({ ...form, eventKey: e.target.value })}
            placeholder="reservation.checked_in"
            className="h-9 w-56 rounded-md border border-border bg-background px-3 font-mono text-xs"
          />
        )}
        {form.triggerType === 'cron' && (
          <input
            value={form.cronMinutes}
            onChange={(e) => setForm({ ...form, cronMinutes: e.target.value })}
            placeholder="Every N minutes"
            type="number"
            className="h-9 w-32 rounded-md border border-border bg-background px-3 text-sm"
          />
        )}
      </div>

      {form.steps.map((s, i) => (
        <div key={i} className="mt-2 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
              {i + 1}. {s.type}
            </span>
            <button
              onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}
              className="ml-auto text-xs text-text-muted"
            >
              ✕
            </button>
          </div>

          {s.type === 'condition' && (
            <div className="mt-2 space-y-1.5">
              {s.config.all.map((c, ci) => (
                <div key={ci} className="flex gap-1.5">
                  <input
                    value={c.field}
                    onChange={(e) =>
                      setStep(i, {
                        ...s,
                        config: {
                          all: s.config.all.map((x, xj) =>
                            xj === ci ? { ...x, field: e.target.value } : x
                          ),
                        },
                      })
                    }
                    placeholder="payload field (vip / guest.name)"
                    className="h-8 flex-1 rounded border border-border bg-surface px-2 font-mono text-xs"
                  />
                  <select
                    value={c.op}
                    onChange={(e) =>
                      setStep(i, {
                        ...s,
                        config: {
                          all: s.config.all.map((x, xj) =>
                            xj === ci ? { ...x, op: e.target.value } : x
                          ),
                        },
                      })
                    }
                    className="h-8 w-24 rounded border border-border bg-surface px-1 text-xs"
                  >
                    {OPS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  {!['exists', 'truthy'].includes(c.op) && (
                    <input
                      value={c.value}
                      onChange={(e) =>
                        setStep(i, {
                          ...s,
                          config: {
                            all: s.config.all.map((x, xj) =>
                              xj === ci ? { ...x, value: e.target.value } : x
                            ),
                          },
                        })
                      }
                      placeholder="value"
                      className="h-8 w-28 rounded border border-border bg-surface px-2 text-xs"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  setStep(i, {
                    ...s,
                    config: { all: [...s.config.all, { field: '', op: 'eq', value: '' }] },
                  })
                }
                className="text-[11px] text-text-muted underline"
              >
                + condition
              </button>
            </div>
          )}

          {s.type === 'delay' && (
            <input
              value={s.config.minutes}
              onChange={(e) => setStep(i, { ...s, config: { minutes: e.target.value } })}
              type="number"
              min="0"
              className="mt-2 h-8 w-28 rounded border border-border bg-surface px-2 text-xs"
            />
          )}

          {s.type === 'action' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <select
                value={s.config.type}
                onChange={(e) =>
                  setStep(i, {
                    type: 'action',
                    config:
                      e.target.value === 'create_task'
                        ? {
                            type: 'create_task',
                            propertyId: property.id,
                            department: 'management',
                            title: 'Task',
                          }
                        : e.target.value === 'folio_item'
                          ? { type: 'folio_item', reservationId: '', productId: '', quantity: 1 }
                          : { type: 'log', message: '' },
                  })
                }
                className="h-8 rounded border border-border bg-surface px-1 text-xs"
              >
                <option value="create_task">Create task</option>
                <option value="folio_item">Post folio item</option>
                <option value="log">Log</option>
              </select>
              {s.config.type === 'create_task' && (
                <>
                  <input
                    value={s.config.department}
                    onChange={(e) =>
                      setStep(i, { ...s, config: { ...s.config, department: e.target.value } })
                    }
                    placeholder="Department"
                    className="h-8 w-28 rounded border border-border bg-surface px-2 text-xs"
                  />
                  <input
                    value={s.config.title}
                    onChange={(e) =>
                      setStep(i, { ...s, config: { ...s.config, title: e.target.value } })
                    }
                    placeholder="Title — supports {{guestName}}"
                    className="h-8 flex-1 rounded border border-border bg-surface px-2 text-xs"
                  />
                </>
              )}
              {s.config.type === 'folio_item' && (
                <>
                  <input
                    value={s.config.reservationId}
                    onChange={(e) =>
                      setStep(i, { ...s, config: { ...s.config, reservationId: e.target.value } })
                    }
                    placeholder="Reservation ID (or leave for payload.reservationId)"
                    className="h-8 w-56 rounded border border-border bg-surface px-2 font-mono text-[11px]"
                  />
                  <input
                    value={s.config.productId}
                    onChange={(e) =>
                      setStep(i, { ...s, config: { ...s.config, productId: e.target.value } })
                    }
                    placeholder="Product ID"
                    className="h-8 w-40 rounded border border-border bg-surface px-2 font-mono text-[11px]"
                  />
                </>
              )}
              {s.config.type === 'log' && (
                <input
                  value={s.config.message}
                  onChange={(e) =>
                    setStep(i, { ...s, config: { ...s.config, message: e.target.value } })
                  }
                  placeholder="Log message"
                  className="h-8 flex-1 rounded border border-border bg-surface px-2 text-xs"
                />
              )}
            </div>
          )}
        </div>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => addStep('condition')}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary"
        >
          + Condition
        </button>
        <button
          onClick={() => addStep('delay')}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary"
        >
          + Delay
        </button>
        <button
          onClick={() => addStep('action')}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary"
        >
          + Action
        </button>
        <button
          onClick={save}
          disabled={busy || !form.name.trim() || form.steps.length === 0}
          className="ml-auto h-9 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save workflow'}
        </button>
      </div>
    </div>
  );
}
