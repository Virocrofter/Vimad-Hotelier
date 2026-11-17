/* apps/web/src/app/app/offices/front/page.jsx
 * Stage 6 - Front Office (plan section 9.4). Behind the offices.front live
 * flag (off -> explicit unavailable state; no v1 front office exists to fall
 * back to). Arrivals/Departures Task Sheets over the Stage 3 today-v2 read
 * model: this Office renders truth, it owns no data. HQ-0 tokens.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFlags, useLiveFlag } from '../../../../components/FlagsProvider';
import { PageShell } from '../../../../components/patterns/PageShell';
import { useSocket } from '../../../../hooks/useSocket';
import { getAccessToken } from '../../../../stores/authStores';
import { usePropertyStore } from '../../../../stores/propertyStore';
import { fetchTodayV2 } from '../../../../api/dashboardTodayV2';

export default function FrontOfficePage() {
  const frontOn = useLiveFlag('offices.front', false);
  if (!frontOn) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="hq-text-h2 text-text-primary">Front Office</h1>
        <p className="mt-2 hq-text-body text-text-secondary">
          This Office is not enabled for your property yet.
        </p>
        <Link
          to="/app/dashboard"
          className="mt-4 inline-block rounded-md bg-primary px-3 py-1.5 hq-text-caption font-medium text-primary-foreground hover:opacity-90"
        >
          Back to Today
        </Link>
      </div>
    );
  }
  return <FrontOfficeV2 />;
}
import { conciergeApi } from '../../../../api/concierge';
const gname = (x) => x.guest ?? x.guestName ?? '—';
const conf = (x) => x.confirmation ?? x.confirmationNumber ?? '—';
const room = (x) => x.room ?? x.roomNumber ?? x.roomType?.name ?? x.roomType ?? '—';
const resLink = (x) => x.links?.reservation ?? '/app/reservations/' + (x.ref?.id ?? x.id);

const reqTitle = (x) =>
  x.title ?? x.request ?? x.description ?? x.type ?? x.message ?? x.subject ?? '—';
const reqGuest = (x) =>
  x.guest ? [x.guest.firstName, x.guest.lastName].filter(Boolean).join(' ') : (x.guestId ?? '—');
const reqRoom = (x) => x.room?.number ?? x.room?.name ?? x.roomNumber ?? x.roomId ?? '—';
const reqStatus = (x) => x.status ?? x.state ?? '—';
const reqPriority = (x) => x.priority ?? x.urgency ?? '—';
const reqType = (x) => x.type ?? x.category ?? '—';
const reqWhen = (x) => {
  const v = x.scheduledAt ?? x.time ?? x.requestedAt ?? x.createdAt ?? '—';
  return v && v !== '—' ? String(v).slice(0, 16).replace('T', ' ') : '—';
};

function StatusChip({ value }) {
  return (
    <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 hq-text-caption capitalize text-text-secondary">
      {String(value ?? '—').replace(/_/g, ' ')}
    </span>
  );
}

function RequestsSheet({ items }) {
  if (!items?.length)
    return (
      <p className="px-3 py-8 text-center hq-text-caption text-text-muted">No guest requests</p>
    );
  return (
    <ul className="divide-y divide-border">
      {items.map((x, i) => (
        <li key={x.id ?? i} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip value={reqStatus(x)} />
              {reqType(x) !== '—' ? <StatusChip value={reqType(x)} /> : null}
              {reqPriority(x) !== '—' ? (
                <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 hq-text-caption text-warning">
                  {reqPriority(x)}
                </span>
              ) : null}
              {x.guest?.vipStatus && x.guest.vipStatus !== 'none' ? (
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 hq-text-caption text-primary">
                  {x.guest.vipStatus}
                </span>
              ) : null}
              <span className="hq-text-caption text-text-muted">{reqRoom(x)}</span>
            </div>
            <p className="mt-1 truncate hq-text-body font-medium text-text-primary">
              {reqTitle(x)}
            </p>
            <p className="hq-text-caption text-text-secondary">
              {reqGuest(x)} · {reqWhen(x)}
            </p>
          </div>
          <Link
            to="/app/concierge"
            className="shrink-0 rounded-md border border-border px-2.5 py-1 hq-text-caption text-text-secondary hover:bg-surface-elevated"
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ArrivalsSheet({ items }) {
  if (!items?.length)
    return (
      <p className="px-3 py-8 text-center hq-text-caption text-text-muted">No remaining arrivals</p>
    );
  return (
    <ul className="divide-y divide-border">
      {items.map((x) => (
        <li
          key={x.ref?.id ?? conf(x)}
          className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip value={x.status} />
              {x.readiness ? (
                <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 hq-text-caption capitalize text-warning">
                  {String(x.readiness).replace(/_/g, ' ')}
                </span>
              ) : null}
              <span className="hq-text-caption text-text-muted">{conf(x)}</span>
            </div>
            <p className="mt-1 truncate hq-text-body font-medium text-text-primary">{gname(x)}</p>
            <p className="hq-text-caption text-text-secondary">
              Room {room(x)}
              {x.party
                ? ` · ${x.party.adults ?? 0} adult${(x.party.adults ?? 0) === 1 ? '' : 's'}`
                : ''}
              {x.specialRequests ? ` · ${x.specialRequests}` : ''}
            </p>
          </div>
          <Link
            to={resLink(x)}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 hq-text-caption text-text-secondary hover:bg-surface-elevated"
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DeparturesSheet({ items, currency }) {
  if (!items?.length)
    return (
      <p className="px-3 py-8 text-center hq-text-caption text-text-muted">No due-outs remaining</p>
    );
  return (
    <ul className="divide-y divide-border">
      {items.map((x) => (
        <li
          key={x.ref?.id ?? conf(x)}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip value={x.status ?? 'due out'} />
              <span className="hq-text-caption text-text-muted">{conf(x)}</span>
              {x.actions?.length ? (
                <span className="hq-text-caption text-text-muted">
                  {x.actions.map((a) => String(a).replace(/_/g, ' ')).join(' · ')}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate hq-text-body font-medium text-text-primary">{gname(x)}</p>
            <p className="hq-text-caption text-text-secondary">Room {room(x)}</p>
          </div>
          <span className="shrink-0 hq-text-caption tabular-nums text-text-secondary">
            {x.balance != null
              ? (Number(x.balance) / 100).toFixed(2) + ' ' + (currency ?? '')
              : '—'}
          </span>
          <Link
            to={resLink(x)}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 hq-text-caption text-text-secondary hover:bg-surface-elevated"
          >
            Open folio
          </Link>
        </li>
      ))}
    </ul>
  );
}

const tzOffsetHours = (tz) => (String(tz || '').includes('Johannesburg') ? 2 : 0);
const fmtTime = (iso, tz) => {
  const d = new Date(new Date(iso).getTime() + tzOffsetHours(tz) * 3600000);
  return (
    String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0')
  );
};

function TapeStrip({ arrivals, departures, timezone }) {
  const moves = [
    ...arrivals.map((x) => ({ t: x.eta, kind: 'Arrival', x })),
    ...departures.map((x) => ({ t: x.dueOut, kind: 'Departure', x })),
  ]
    .filter((m) => m.t)
    .sort((a, b) => new Date(a.t) - new Date(b.t));
  if (!moves.length)
    return (
      <p className="px-3 py-8 text-center hq-text-caption text-text-muted">
        No movements scheduled for the business day
      </p>
    );
  return (
    <ul className="divide-y divide-border">
      {moves.map((m, i) => (
        <li
          key={m.t + '-' + i}
          className="grid grid-cols-[3.5rem_6rem_1fr_auto] items-center gap-2 px-3 py-2"
        >
          <span className="hq-text-caption tabular-nums text-text-muted">
            {fmtTime(m.t, timezone)}
          </span>
          <span
            className={
              'rounded-full border px-2 py-0.5 hq-text-caption ' +
              (m.kind === 'Arrival'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-surface-elevated text-text-secondary')
            }
          >
            {m.kind}
          </span>
          <span className="truncate hq-text-body text-text-primary">{gname(m.x)}</span>
          <span className="hq-text-caption text-text-secondary">Room {room(m.x)}</span>
        </li>
      ))}
    </ul>
  );
}

function FrontOfficeV2() {
  const qc = useQueryClient();
  const [lens, setLens] = useState('arrivals');
  const currentPropertyId = usePropertyStore((s) => s.currentPropertyId);
  const propertyId = currentPropertyId ?? undefined;
  const q = useQuery({
    queryKey: ['front-office-today', String(propertyId)],
    queryFn: () => fetchTodayV2(propertyId),
    enabled: !!propertyId,
  });
  const q2 = useQuery({
    queryKey: ['front-office-requests', String(propertyId)],
    queryFn: () => conciergeApi.board(new Date().toISOString().slice(0, 10), propertyId),
    enabled: !!propertyId,
  });
  const payload = q.data?.data ?? q.data ?? {};
  const ctx = payload.context ?? {};
  const arr = payload.sections?.arrivals ?? {};
  const dep = payload.sections?.departures ?? {};
  const arrItems = arr.items ?? [];
  const depItems = dep.items ?? [];
  const board = q2.data ?? {};
  const reqSeen = new Set();
  const reqItems = [...(board.overdue ?? []), ...Object.values(board.sections ?? {}).flat()].filter(
    (x) => {
      const k = x?.id ?? JSON.stringify(x);
      if (reqSeen.has(k)) return false;
      reqSeen.add(k);
      return true;
    }
  );

  const { isConnected, on } = useSocket(getAccessToken());
  useEffect(() => {
    let t = null;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(
        () =>
          qc.invalidateQueries({
            predicate: (x) =>
              x.queryKey[0] === 'front-office-today' || x.queryKey[0] === 'front-office-requests',
          }),
        400
      );
    };
    on('ops:mutation', handler);
    return () => clearTimeout(t);
  }, [on, qc]);

  const pill = 'rounded-md border px-2.5 py-1 hq-text-caption ';
  const pillCls = (id) =>
    pill +
    (lens === id
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border text-text-secondary hover:bg-surface-elevated');
  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hq-text-h2 text-text-primary">Front Office</h1>
          <p className="hq-text-caption text-text-muted">
            {ctx.businessDate ?? '—'} · Arrivals {arr.summary?.total ?? arrItems.length} · Due out{' '}
            {dep.summary?.total ?? depItems.length} · Requests {reqItems.length}
            <span className={isConnected ? ' text-primary' : ' text-danger'}>
              {' '}
              · {isConnected ? 'Live' : 'Offline'}
            </span>
          </p>
        </div>
      </div>
      <div className="mb-3 flex gap-2">
        <button onClick={() => setLens('arrivals')} className={pillCls('arrivals')}>
          Arrivals
        </button>
        <button onClick={() => setLens('departures')} className={pillCls('departures')}>
          Departures
        </button>
        <button onClick={() => setLens('tape')} className={pillCls('tape')}>
          Tape
        </button>
        <button onClick={() => setLens('requests')} className={pillCls('requests')}>
          Requests
        </button>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {q.isLoading ? (
          <p className="px-3 py-8 text-center hq-text-caption text-text-muted">Loading...</p>
        ) : q.isError ? (
          <div className="px-3 py-8 text-center">
            <p className="hq-text-caption text-danger">Failed to load</p>
            <button
              onClick={() => q.refetch()}
              className="mt-2 rounded-md border border-border px-3 py-1 hq-text-caption text-text-secondary hover:bg-surface-elevated"
            >
              Retry
            </button>
          </div>
        ) : lens === 'arrivals' ? (
          <ArrivalsSheet items={arrItems} />
        ) : lens === 'tape' ? (
          <TapeStrip arrivals={arrItems} departures={depItems} timezone={ctx.timezone} />
        ) : lens === 'requests' ? (
          <RequestsSheet items={reqItems} />
        ) : (
          <DeparturesSheet items={depItems} currency={ctx.currency} />
        )}
      </div>
    </PageShell>
  );
}
