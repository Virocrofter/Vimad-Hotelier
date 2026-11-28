/* src/app/admin/billing/plans/page.jsx
 * Plan Catalog & Pricing Rules (Phase 2). Backed by the DB plan_catalog
 * table via GET/PUT /admin/billing/plans — editing a price here is a DB
 * row update, not a deploy. v3 bands seeded from the pricing doc;
 * perRoomZar/includedRooms are hypotheses — govern weekly. */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { KpiStrip } from '../kpi';
import '../billing-pages.css';

const fmtR = (n) =>
  n == null ? '—' : 'R ' + Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 });

export default function PlansPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const notify = useCallback((msg, isErr) => {
    clearTimeout(timer.current);
    setToast({ msg, isErr });
    timer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.listPlans();
      setRows(Array.isArray(data) ? data : data?.plans || data?.data || []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const list = rows || [];
  const active = list.filter((p) => p.isActive);
  const kpis = [
    { l: 'Plans', v: list.length },
    { l: 'Active', v: active.length },
    {
      l: 'Highest band',
      v: list.length ? fmtR(Math.max(...list.map((p) => p.bandMaxZar ?? 0))) : '—',
    },
    { l: 'Custom band', v: list.filter((p) => p.bandMaxZar == null && p.monthlyZar > 0).length },
  ];

  return (
    <div className="vb2-wrap">
      <KpiStrip items={kpis} />
      <div className="vb2-toolbar">
        <div style={{ flex: 1 }} />
        <button type="button" className="vb2-btn" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="vb2-table-card">
        {error && (
          <div className="vb2-empty">
            <div className="vb2-empty-title">Could not load plan catalog</div>
            <div>{error}</div>
          </div>
        )}
        {!error &&
          rows === null &&
          [1, 2, 3].map((n) => (
            <div className="vb2-skel" key={n}>
              <div className="vb2-skel-bar" style={{ width: 40 + n * 18 + '%' }} />
            </div>
          ))}
        {!error && rows !== null && list.length === 0 && (
          <div className="vb2-empty">
            <div className="vb2-empty-title">No plans in catalog</div>
            <div>Run migration 20261128053000_phase2_plan_catalog.</div>
          </div>
        )}
        {!error && rows !== null && list.length > 0 && (
          <div className="vb2-table-scroll">
            <table className="vb2-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Band (ex VAT)</th>
                  <th>Base / mo</th>
                  <th>Per extra room</th>
                  <th>Included rooms</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.code} style={{ cursor: 'default' }}>
                    <td>
                      <div className="vb2-num">{p.label}</div>
                      <div className="vb2-muted">{p.code}</div>
                    </td>
                    <td className="vb2-num">
                      {p.monthlyZar === 0
                        ? 'Free'
                        : p.bandMaxZar == null
                          ? 'from ' + fmtR(p.bandMinZar)
                          : fmtR(p.bandMinZar) + ' – ' + fmtR(p.bandMaxZar)}
                    </td>
                    <td className="vb2-num">{fmtR(p.monthlyZar)}</td>
                    <td className="vb2-num">{p.perRoomZar ? fmtR(p.perRoomZar) : '—'}</td>
                    <td className="vb2-num">{p.includedRooms || '—'}</td>
                    <td>
                      <span className={'vb2-badge ' + (p.isActive ? 'ok' : 'muted')}>
                        {p.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="vb2-btn small" onClick={() => setEditing(p)}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditPlanModal
          plan={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
            notify('Plan updated');
          }}
          notify={notify}
        />
      )}
      {toast && <div className={'vb2-toast' + (toast.isErr ? ' err' : '')}>{toast.msg}</div>}
    </div>
  );
}

function EditPlanModal({ plan, onClose, onDone, notify }) {
  const [form, setForm] = useState({
    label: plan.label,
    monthlyZar: plan.monthlyZar,
    bandMinZar: plan.bandMinZar,
    bandMaxZar: plan.bandMaxZar,
    perRoomZar: plan.perRoomZar,
    includedRooms: plan.includedRooms,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    const bandMaxZar =
      form.bandMaxZar === '' || form.bandMaxZar == null ? null : Number(form.bandMaxZar);
    if (bandMaxZar != null && Number(form.bandMinZar) > bandMaxZar) {
      return notify('Band min cannot exceed band max', true);
    }
    setBusy(true);
    try {
      await api.updatePlan(plan.code, {
        label: form.label,
        monthlyZar: Number(form.monthlyZar),
        bandMinZar: Number(form.bandMinZar),
        bandMaxZar,
        perRoomZar: Number(form.perRoomZar),
        includedRooms: Number(form.includedRooms),
      });
      onDone();
    } catch (e) {
      notify(e.message, true);
      setBusy(false);
    }
  };

  return (
    <div className="vb2-modal-backdrop" onClick={onClose}>
      <div className="vb2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="vb2-modal-title">Edit plan — {plan.label}</div>
        <div className="vb2-field">
          <label>Label</label>
          <input className="vb2-input" value={form.label} onChange={set('label')} />
        </div>
        <div className="vb2-field">
          <label>Base monthly (ZAR, ex VAT)</label>
          <input
            className="vb2-input"
            type="number"
            min="0"
            value={form.monthlyZar}
            onChange={set('monthlyZar')}
          />
        </div>
        <div className="vb2-field">
          <label>Band min (ZAR)</label>
          <input
            className="vb2-input"
            type="number"
            min="0"
            value={form.bandMinZar}
            onChange={set('bandMinZar')}
          />
        </div>
        <div className="vb2-field">
          <label>Band max (ZAR, empty = open/custom)</label>
          <input
            className="vb2-input"
            type="number"
            min="0"
            value={form.bandMaxZar ?? ''}
            onChange={set('bandMaxZar')}
          />
        </div>
        <div className="vb2-field">
          <label>Per extra room (ZAR / room / mo)</label>
          <input
            className="vb2-input"
            type="number"
            min="0"
            value={form.perRoomZar}
            onChange={set('perRoomZar')}
          />
        </div>
        <div className="vb2-field">
          <label>Included rooms</label>
          <input
            className="vb2-input"
            type="number"
            min="0"
            value={form.includedRooms}
            onChange={set('includedRooms')}
          />
        </div>
        <div className="vb2-modal-foot">
          <button type="button" className="vb2-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="vb2-btn primary" disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
