/* 4.1b — ONE CheckInDialog for every check-in trigger (workspace, cockpit,
 * tape). Attempts the check-in; on ROOM_NOT_READY it interrupts with
 * Make-ready / reassign / check-in-anyway / cancel exits. */
import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

export default function CheckInDialog({ reservationId, room, onClose, onCheckedIn }) {
  const [phase, setPhase] = useState('trying');
  const [blockedMsg, setBlockedMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const attempt = async (force = false) => {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/reservations/${reservationId}/check-in`, force ? { force: true } : {});
      setPhase('done');
      onCheckedIn?.();
      setTimeout(onClose, 900);
    } catch (e) {
      const body = e?.response?.data?.error;
      if (body?.code === 'ROOM_NOT_READY') {
        setBlockedMsg(body.message ?? 'Room is not ready');
        setPhase('blocked');
      } else {
        setErr(body?.message ?? 'Check-in failed');
        setPhase('error');
      }
    } finally {
      setBusy(false);
    }
  };

  const makeReady = async () => {
    if (!room?.id) return;
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/housekeeping/rooms/${room.id}/status`, {
        housekeepingStatus: 'ready',
      });
      await attempt(false);
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Could not update the room');
      setBusy(false);
    }
  };

  useEffect(() => {
    attempt(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
      {phase === 'trying' && <p className="text-sm text-text-secondary">Checking in…</p>}
      {phase === 'done' && <p className="text-sm font-medium text-success">Checked in ✓</p>}
      {phase === 'blocked' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-warning">{blockedMsg}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={makeReady}
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Mark room ready
            </button>
            <button
              onClick={() => (window.location.href = '/app/rooms')}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary"
            >
              Reassign
            </button>
            <button
              onClick={() => attempt(true)}
              disabled={busy}
              className="rounded-md border border-warning/40 px-3 py-1.5 text-xs font-medium text-warning disabled:opacity-50"
            >
              Check in anyway
            </button>
            <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs text-text-muted">
              Cancel
            </button>
          </div>
        </div>
      )}
      {(phase === 'error' || err) && (
        <div className="space-y-3">
          <p className="text-sm text-danger">{err ?? 'Check-in failed'}</p>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/* CheckInHost — ONE mount in the app shell; every check-in trigger dispatches
 * window 'vimad:check-in' with { reservationId, room? } and the shared
 * guardrail dialog handles it. */
export function CheckInHost() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    const handler = (e) => setTarget(e.detail ?? null);
    window.addEventListener('vimad:check-in', handler);
    return () => window.removeEventListener('vimad:check-in', handler);
  }, []);
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <CheckInDialog
        reservationId={target.reservationId}
        room={target.room ?? null}
        onClose={() => setTarget(null)}
        onCheckedIn={() => window.dispatchEvent(new CustomEvent('vimad:checked-in'))}
      />
    </div>
  );
}

export function requestCheckIn(reservationId, room = null) {
  window.dispatchEvent(new CustomEvent('vimad:check-in', { detail: { reservationId, room } }));
}
