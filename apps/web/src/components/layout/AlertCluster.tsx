/* apps/web/src/components/layout/AlertCluster.tsx
 * Topbar alert cluster (blueprint S4): Needs Attention open count + Inbox
 * unread, polled every 60s. NOT included: notifications — useNotifications
 * is still mock data (filed as a bug); it joins when wired to the real API. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Inbox } from 'lucide-react';
import { listExceptions } from '../../api/exceptions';
import { commsApi } from '../../api/comms';

const CHIP = 'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm';
const BASE = {
  borderColor: 'var(--hq-hairline)',
  background: 'var(--hq-surface-1)',
  color: 'var(--text-secondary)',
} as const;

export function AlertCluster() {
  const [needsAttention, setNeedsAttention] = useState<number | null>(null);
  const [inboxUnread, setInboxUnread] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const ex = await listExceptions('open');
        if (!alive) return;
        setNeedsAttention(ex?.counts?.open ?? ex?.items?.length ?? 0);
      } catch {
        if (alive) setNeedsAttention(null);
      }
      try {
        const inbox = await commsApi.inbox('open');
        const threads = Array.isArray(inbox) ? inbox : (inbox?.data ?? []);
        const unread = (threads as Array<{ unreadForStaff?: number }>).reduce(
          (n, t) => n + (t.unreadForStaff ?? 0),
          0
        );
        if (alive) setInboxUnread(unread);
      } catch {
        if (alive) setInboxUnread(null);
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const alertStyle = needsAttention
    ? {
        borderColor: 'rgb(180 83 9)',
        background: 'rgb(180 83 9 / 0.12)',
        color: 'rgb(180 83 9)',
      }
    : BASE;

  return (
    <div className="flex items-center gap-1.5">
      <Link to="/app/exceptions" className={CHIP} style={alertStyle} title="Needs Attention queue">
        <AlertTriangle className="h-4 w-4" />
        {needsAttention !== null && (
          <span
            className="text-xs font-semibold text-text-primary"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {needsAttention}
          </span>
        )}
      </Link>
      <Link to="/app/comms" className={CHIP} style={BASE} title="Inbox">
        <Inbox className="h-4 w-4" />
        {inboxUnread !== null && inboxUnread > 0 && (
          <span
            className="text-xs font-semibold text-text-primary"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {inboxUnread}
          </span>
        )}
      </Link>
    </div>
  );
}
