/* src/app/admin/crm/page.jsx
 * CRM / Durban funnel (Phase 3, blueprint Pillar 6). Kanban over the
 * marketing leads table: zones A-J, room counts, current engine, walk-in
 * notes. Convert = run the lead through the demo-access engine and hand
 * back a living pilot hotel + 24h magic link. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Target, X } from 'lucide-react';
import { convertLead, listLeads, updateLead } from '@/api/adminTenants';

const STAGES = [
  { key: 'new', label: 'New', dot: 'bg-info' },
  { key: 'contacted', label: 'Contacted', dot: 'bg-accent' },
  { key: 'demo_booked', label: 'Demo booked', dot: 'bg-secondary' },
  { key: 'pilot', label: 'Pilot', dot: 'bg-warning' },
  { key: 'won', label: 'Won', dot: 'bg-accent' },
  { key: 'lost', label: 'Lost', dot: 'bg-text-muted' },
];
const ZONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export default function CrmPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [zoneFilter, setZoneFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [editing, setEditing] = useState(null);
  const [converted, setConverted] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (msg, isErr) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = {};
      if (zoneFilter) params.zone = zoneFilter;
      if (debounced) params.search = debounced;
      setData(await listLeads(params));
    } catch (e) {
      setError(e.message);
      setData({ items: [] });
    }
  }, [zoneFilter, debounced]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const byStage = useMemo(() => {
    const m = new Map(STAGES.map((s) => [s.key, []]));
    for (const l of data?.items ?? []) {
      const k = m.has(l.status) ? l.status : 'new';
      m.get(k).push(l);
    }
    return m;
  }, [data]);

  const setStatus = async (lead, status) => {
    try {
      await updateLead(lead.id, { status });
      await load();
    } catch (e) {
      notify(e.message, true);
    }
  };

  const doConvert = async (lead) => {
    if (
      !window.confirm(
        'Provision a 14-day pilot hotel for ' + (lead.propertyName || lead.name) + '?'
      )
    )
      return;
    try {
      const r = await convertLead(lead.id);
      setConverted({ lead, ...r });
      await load();
    } catch (e) {
      notify(e.message, true);
    }
  };

  const total = data?.items?.length ?? 0;
  const pilotCount = byStage.get('pilot')?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
            <Target className="h-6 w-6" /> CRM / Durban Funnel
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {total} prospects · {pilotCount} piloted · zones A-J
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

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, property, email…"
          className="h-10 w-72 rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
        >
          <option value="">All zones</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              Zone {z}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-danger">Could not load: {error}</div>}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className="w-72 shrink-0">
            <div className="mb-2 flex items-center gap-2">
              <span className={'h-2 w-2 rounded-full ' + stage.dot} />
              <span className="text-sm font-semibold text-text-primary">{stage.label}</span>
              <span className="text-xs text-text-muted">{byStage.get(stage.key).length}</span>
            </div>
            <div className="space-y-2">
              {byStage.get(stage.key).map((lead) => (
                <div key={lead.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="font-medium text-text-primary">{lead.propertyName || lead.name}</p>
                  <p className="text-xs text-text-muted">
                    {lead.name}
                    {lead.zone ? ' · Zone ' + lead.zone : ''}
                    {lead.roomCount ? ' · ' + lead.roomCount + ' rooms' : ''}
                  </p>
                  {lead.currentPms && (
                    <p className="mt-1 inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary">
                      {lead.currentPms}
                    </p>
                  )}
                  {lead.walkInNotes && (
                    <p className="mt-1 line-clamp-2 text-xs italic text-text-muted">
                      {lead.walkInNotes}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={lead.status ?? 'new'}
                      onChange={(e) => setStatus(lead, e.target.value)}
                      className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEditing(lead)}
                      className="h-7 rounded-md border border-border px-2 text-xs text-text-secondary hover:bg-background"
                    >
                      Edit
                    </button>
                    {!lead.demoSessionId && (
                      <button
                        type="button"
                        onClick={() => doConvert(lead)}
                        className="h-7 rounded-md border border-accent/30 px-2 text-xs text-accent hover:bg-accent/10"
                      >
                        Convert
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {byStage.get(stage.key).length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditLeadModal
          lead={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
          notify={notify}
        />
      )}

      {converted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConverted(null)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-text-primary">Pilot provisioned</h2>
              <button
                onClick={() => setConverted(null)}
                className="rounded-md p-1 text-text-muted hover:bg-surface-elevated"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {converted.lead.propertyName || converted.lead.name} is live for 14 days.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-text-secondary">Tenant slug</span>
                <span className="font-mono text-text-primary">{converted.tenantSlug}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-text-secondary">Demo login</span>
                <span className="font-mono text-text-primary">
                  {converted.demoCredentials?.email}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-text-secondary">Demo password</span>
                <span className="font-mono text-text-primary">
                  {converted.demoCredentials?.password}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-secondary">Magic link (24h)</span>
                <span className="break-all text-right font-mono text-xs text-accent">
                  {converted.inviteUrl}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-text-muted">
              Send the magic link to the hotel - it opens their living demo, seeded with guests,
              stays, folios and tasks. Convert to trial later from Demo Access.
            </p>
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

function EditLeadModal({ lead, onClose, onDone, notify }) {
  const [form, setForm] = useState({
    propertyName: lead.propertyName ?? '',
    name: lead.name ?? '',
    phone: lead.phone ?? '',
    roomCount: lead.roomCount ?? '',
    currentPms: lead.currentPms ?? '',
    zone: lead.zone ?? '',
    walkInNotes: lead.walkInNotes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      await updateLead(lead.id, {
        propertyName: form.propertyName,
        name: form.name,
        phone: form.phone,
        currentPms: form.currentPms,
        zone: form.zone || null,
        walkInNotes: form.walkInNotes,
        roomCount: form.roomCount === '' ? null : Number(form.roomCount),
      });
      onDone();
    } catch (e) {
      notify(e.message, true);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-text-primary">Edit prospect</h2>
        <div className="mt-4 space-y-3">
          <input
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
            placeholder="Property name"
            value={form.propertyName}
            onChange={set('propertyName')}
          />
          <input
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
            placeholder="Contact name"
            value={form.name}
            onChange={set('name')}
          />
          <input
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
            placeholder="Phone / WhatsApp"
            value={form.phone}
            onChange={set('phone')}
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              className="h-9 w-1/2 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
              placeholder="Rooms"
              value={form.roomCount}
              onChange={set('roomCount')}
            />
            <select
              className="h-9 w-1/2 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
              value={form.zone}
              onChange={set('zone')}
            >
              <option value="">Zone</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  Zone {z}
                </option>
              ))}
            </select>
          </div>
          <input
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
            placeholder="Current engine (Paper / NightsBridge / …)"
            value={form.currentPms}
            onChange={set('currentPms')}
          />
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
            rows={3}
            placeholder="Walk-in notes"
            value={form.walkInNotes}
            onChange={set('walkInNotes')}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border px-4 text-sm text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
