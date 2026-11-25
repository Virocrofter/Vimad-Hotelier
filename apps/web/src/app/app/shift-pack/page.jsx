/* apps/web/src/app/app/shift-pack/page.jsx — P45 shift pack: the load-shedding
 * fallback sheet. Pull once, print, work from paper until the fiber returns. */
import { useEffect, useState } from 'react';
import { usePropertyScope } from '../../../hooks/usePropertyScope';
import { apiClient } from '../../../api/client';

const Section = ({ title, children }) => (
  <section className="rounded-xl border border-border bg-surface p-4">
    <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
    <div className="mt-2">{children}</div>
  </section>
);

const Table = ({ rows, cols }) =>
  rows.length === 0 ? (
    <p className="text-xs text-text-muted">None.</p>
  ) : (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-text-muted">
          {cols.map((c) => (
            <th key={c.key} className="py-1 pr-3">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border/60">
            {cols.map((c) => (
              <td key={c.key} className="py-1 pr-3 text-text-secondary">
                {r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

export default function ShiftPackPage() {
  const { current } = usePropertyScope();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!current?.id) return;
    apiClient
      .get('/shift-pack/today', { params: { propertyId: current.id } })
      .then((r) => setData(r?.data?.data ?? null))
      .catch((e) => setErr(e?.data?.error?.msg ?? 'Shift pack failed to load'));
  }, [current?.id]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Shift Pack</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Load-shedding / fiber-drop fallback: pull once, print, work from paper.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          disabled={!data}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
        >
          Print sheet
        </button>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}
      {!data && !err && <p className="text-sm text-text-muted">Loading…</p>}

      {data && (
        <>
          <p className="text-xs text-text-muted">
            {data.property.name} · business date {data.businessDate} · pulled{' '}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Section title={`Arrivals (${data.arrivals.length})`}>
              <Table
                rows={data.arrivals}
                cols={[
                  { key: 'guest', label: 'Guest' },
                  { key: 'confirmationNumber', label: 'Conf #' },
                  { key: 'status', label: 'Status' },
                  { key: 'balance', label: 'Balance' },
                ]}
              />
            </Section>
            <Section title={`Departures (${data.departures.length})`}>
              <Table
                rows={data.departures}
                cols={[
                  { key: 'guest', label: 'Guest' },
                  { key: 'confirmationNumber', label: 'Conf #' },
                  { key: 'status', label: 'Status' },
                  { key: 'balance', label: 'Balance' },
                ]}
              />
            </Section>
            <Section title={`In-house roll call (${data.inHouse.length})`}>
              <Table
                rows={data.inHouse}
                cols={[
                  { key: 'guest', label: 'Guest' },
                  { key: 'room', label: 'Room' },
                  { key: 'confirmationNumber', label: 'Conf #' },
                ]}
              />
            </Section>
            <Section title={`Rooms (${data.rooms.length})`}>
              <Table
                rows={data.rooms}
                cols={[
                  { key: 'number', label: 'Room' },
                  { key: 'floor', label: 'Floor' },
                  { key: 'housekeepingStatus', label: 'HK' },
                  { key: 'serviceStatus', label: 'Service' },
                  { key: 'occupied', label: 'Occupied' },
                ]}
              />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
