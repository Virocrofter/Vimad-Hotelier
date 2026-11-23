/* /app/bi — C2′ BI hub: the six curated families as cards (Phase 6.1). */
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis } from 'recharts';
import { apiClient } from '../../../api/client';

export default function BiHubPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [curve, setCurve] = useState(null);

  useEffect(() => {
    apiClient
      .get('/properties')
      .then(async (r) => {
        const raw = r?.data?.data ?? r?.data ?? [];
        const props = Array.isArray(raw) ? raw : (raw.properties ?? []);
        const first = props[0];
        if (!first) throw new Error('no property');
        const fam = await apiClient.get('/bi/families', { params: { propertyId: first.id } });
        setData(fam?.data?.data ?? fam?.data);
        const br = await apiClient.get('/bi/briefing', { params: { propertyId: first.id } });
        setBriefing(br?.data?.data ?? br?.data);
        const cv = await apiClient.get('/bi/booking-curve', {
          params: { propertyId: first.id, days: 30 },
        });
        setCurve(cv?.data?.data ?? cv?.data);
      })
      .catch((e) => setErr(e?.response?.data?.error?.message ?? e.message));
  }, []);

  if (err) return <div className="p-6 text-sm text-danger">{err}</div>;
  if (!data) return <div className="p-6 text-sm text-text-muted">Loading the hub…</div>;

  const fmtR = (n) => 'R ' + Number(n ?? 0).toLocaleString('en-ZA');
  const card = 'rounded-xl border border-border bg-surface p-4';

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="hq-text-title font-semibold">Insights</h1>
        <p className="hq-text-caption text-text-muted">
          C2′ BI hub — generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Filter rail">
        <select
          aria-label="Property"
          value={propId ?? ''}
          onChange={(e) => load(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1 text-[11px]"
        >
          {props.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Saved views"
          value=""
          onChange={(e) => {
            const v = views.find((x) => x.id === e.target.value);
            if (v?.propertyId) load(v.propertyId);
          }}
          className="rounded border border-border bg-surface px-2 py-1 text-[11px]"
        >
          <option value="">Saved views…</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          onClick={async () => {
            const name = window.prompt('Name this view');
            if (!name?.trim()) return;
            await apiClient.post('/bi/views', {
              name,
              propertyId: propId,
              config: { propertyId: propId },
            });
            await refreshViews();
          }}
          className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-elevated"
        >
          Save view
        </button>
      </div>

      {briefing && (
        <div
          className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3"
          aria-label="Daily briefing"
        >
          {briefing.sentences.map((s) => (
            <span
              key={s.rule}
              title={JSON.stringify(s.data)}
              className={
                'rounded-full px-2.5 py-1 text-[11px] font-medium ' +
                (s.kind === 'positive'
                  ? 'bg-success/15 text-[var(--success)]'
                  : s.kind === 'warning'
                    ? 'bg-warning/25 text-[var(--warning-soft-fg)]'
                    : s.kind === 'action'
                      ? 'bg-accent/15 text-[var(--accent-soft-fg)]'
                      : 'bg-[var(--hq-surface-2)] text-text-secondary')
              }
            >
              {s.text}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Daily summary
          </p>
          <p className="hq-tnum mt-2 text-2xl font-bold">{data.dailySummary.occupancyPct}% occ</p>
          <p className="text-xs text-text-secondary">
            {data.dailySummary.arrivalsToday} arrivals · {data.dailySummary.departuresToday}{' '}
            departures · {data.dailySummary.stayovers} in house · ADR {fmtR(data.dailySummary.adr)}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Occupancy &amp; revenue
          </p>
          <p className="hq-tnum mt-2 text-2xl font-bold">
            {fmtR(data.occupancyRevenue.revenue30d)}
          </p>
          <p className="text-xs text-text-secondary">
            {data.occupancyRevenue.inHouse}/{data.occupancyRevenue.rooms} rooms · 30-day revenue
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Payments mix · 30d
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {data.paymentsMix.map((p) => (
              <li key={p.channel} className="flex justify-between">
                <span className="capitalize text-text-secondary">{p.channel}</span>
                <span className="hq-tnum">
                  {p.count} · {formatMoneyMinor(p.totalMinor)}
                </span>
              </li>
            ))}
            {data.paymentsMix.length === 0 && (
              <li className="text-text-muted">No payments in window.</li>
            )}
          </ul>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">AR aging</p>
          <ul className="mt-2 space-y-1 text-xs">
            {data.arAging.map((a) => (
              <li key={a.status} className="flex justify-between">
                <span className="text-text-secondary">{a.status.replace(/_/g, ' ')}</span>
                <span className="hq-tnum">
                  {a.count} · {fmtR(a.total - a.amountPaid)}
                </span>
              </li>
            ))}
            {data.arAging.length === 0 && <li className="text-text-muted">No AR invoices.</li>}
          </ul>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Blocked rooms
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {data.blockedRooms.map((b) => (
              <li key={b.serviceStatus} className="flex justify-between">
                <span className="text-text-secondary">{b.serviceStatus}</span>
                <span className="hq-tnum">{b.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Booking curve vs last year
          </p>
          {curve ? (
            <>
              <LineChart
                width={320}
                height={120}
                data={curve.series}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <XAxis dataKey="offset" hide />
                <YAxis hide />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="var(--text-muted)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
              <p className="hq-tnum text-xs text-text-secondary">
                {curve.totals.current} vs {curve.totals.baseline} last year (
                {curve.totals.delta >= 0 ? '+' : ''}
                {curve.totals.delta})
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted">Loading curve…</p>
          )}
        </div>

        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pickup</p>
          <p className="hq-tnum mt-2 text-2xl font-bold">
            {data.pickup.delta >= 0 ? '+' : ''}
            {data.pickup.delta}
          </p>
          <p className="text-xs text-text-secondary">
            next 7d {data.pickup.next7dArrivals} arrivals vs last 7d {data.pickup.last7dArrivals}
          </p>
        </div>
      </div>
    </div>
  );
}
