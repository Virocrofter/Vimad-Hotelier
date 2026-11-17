/* apps/web/src/app/app/offices/maintenance/page.jsx
 * Stage 7 - Maintenance Office (plan section 9.5). Behind offices.maintenance
 * (off -> explicit unavailable state; no v1 maintenance page exists). Work
 * orders = universal tasks in the maintenance department; this Office renders
 * truth, it owns no data. HQ-0 tokens. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFlags, useLiveFlag } from '../../../../components/FlagsProvider';
import { PageShell } from '../../../../components/patterns/PageShell';
import { useSocket } from '../../../../hooks/useSocket';
import { getAccessToken } from '../../../../stores/authStores';
import { usePropertyStore } from '../../../../stores/propertyStore';
import { listTasks } from '../../../../api/tasks';

const DEPT = 'maintenance';

export default function MaintenanceOfficePage() {
  const on = useLiveFlag('offices.maintenance', false);
  if (!on) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="hq-text-h2 text-text-primary">Maintenance</h1>
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
  return <MaintenanceOfficeV2 />;
}

const roomOf = (x) => x.room?.number ?? x.room?.name ?? x.roomNumber ?? x.roomId ?? '—';
const guestOf = (x) => {
  const g = x.guest ? [x.guest.firstName, x.guest.lastName].filter(Boolean).join(' ') : null;
  return g || x.guestId || '—';
};
const dueOf = (x) => (x.dueAt ? String(x.dueAt).slice(0, 16).replace('T', ' ') : '—');

function WorkOrderSheet({ items }) {
  if (!items?.length)
    return (
      <p className="px-3 py-8 text-center hq-text-caption text-text-muted">No open work orders</p>
    );
  return (
    <ul className="divide-y divide-border">
      {items.map((x) => (
        <li key={x.id} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 hq-text-caption capitalize text-text-secondary">
                {String(x.status ?? '—').replace(/_/g, ' ')}
              </span>
              {x.priority ? (
                <span
                  className={
                    'rounded-full border px-2 py-0.5 hq-text-caption capitalize ' +
                    (String(x.priority).includes('high') || String(x.priority).includes('urgent')
                      ? 'border-danger/40 bg-danger/10 text-danger'
                      : 'border-border bg-surface-elevated text-text-secondary')
                  }
                >
                  {x.priority}
                </span>
              ) : null}
              {x.slaBreached ? (
                <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 hq-text-caption text-danger">
                  SLA
                </span>
              ) : null}
              <span className="hq-text-caption text-text-muted">Room {roomOf(x)}</span>
            </div>
            <p className="mt-1 truncate hq-text-body font-medium text-text-primary">
              {x.title ?? '—'}
            </p>
            <p className="hq-text-caption text-text-secondary">
              {guestOf(x)} · due {dueOf(x)}
              {x.assignee?.firstName ? ` · ${x.assignee.firstName}` : ''}
            </p>
          </div>
          <Link
            to="/app/tasks"
            className="shrink-0 rounded-md border border-border px-2.5 py-1 hq-text-caption text-text-secondary hover:bg-surface-elevated"
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MaintenanceOfficeV2() {
  const qc = useQueryClient();
  const currentPropertyId = usePropertyStore((s) => s.currentPropertyId);
  const propertyId = currentPropertyId ?? undefined;
  const q = useQuery({
    queryKey: ['maintenance-tasks', String(propertyId)],
    queryFn: () => listTasks({ department: DEPT, status: 'open', propertyId }),
    enabled: !!propertyId,
  });
  const payload = q.data?.data ?? q.data ?? [];
  const items = Array.isArray(payload) ? payload : [];
  const sla = items.filter((x) => x.slaBreached).length;

  const { isConnected, on } = useSocket(getAccessToken());
  useEffect(() => {
    let t = null;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(
        () => qc.invalidateQueries({ predicate: (x) => x.queryKey[0] === 'maintenance-tasks' }),
        400
      );
    };
    on('ops:mutation', handler);
    return () => clearTimeout(t);
  }, [on, qc]);

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hq-text-h2 text-text-primary">Maintenance</h1>
          <p className="hq-text-caption text-text-muted">
            Open work orders {items.length} · SLA breaches {sla} · Rooms out of order 0
            <span className={isConnected ? ' text-primary' : ' text-danger'}>
              {' '}
              · {isConnected ? 'Live' : 'Offline'}
            </span>
          </p>
        </div>
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
        ) : (
          <WorkOrderSheet items={items} />
        )}
      </div>
    </PageShell>
  );
}
