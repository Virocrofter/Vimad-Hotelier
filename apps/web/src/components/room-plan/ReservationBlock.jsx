import { Star, Lock, Flag, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

/* Tape Chart booking bar (Mews-language redo): the bar IS the stay — a
 * surface card with a 3px status stripe, guest name leading, icons trailing.
 * Conf# lives in the hover popover. */
const STATUS_META = {
  confirmed: { label: 'Confirmed', color: '#818cf8' },
  checked_in: { label: 'In house', color: '#34d399' },
  checked_out: { label: 'Departed', color: '#94a3b8' },
};

export default function ReservationBlock({
  reservation: r,
  selected,
  compact,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
  onContextMenu,
  onHover,
  onLeave,
}) {
  const meta = STATUS_META[r.status] ?? STATUS_META.confirmed;
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => onHover && onHover(e, r.id)}
      onMouseLeave={onLeave}
      className={cn(
        'flex h-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-sm py-0.5 pl-2 pr-1.5 transition-shadow hover:shadow-md',
        selected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{
        background: 'var(--hq-surface-1)',
        border: '1px solid var(--hq-hairline)',
        borderLeft: `3px solid ${meta.color}`,
        color: 'var(--text-primary)',
      }}
      title={`${r.guestName} · ${r.confirmationNumber} · ${meta.label}`}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{r.guestName}</span>
      {r.vipStatus && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
      {r.fixedRoom && <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />}
      {r.openTraces > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-rose-500">
          <Flag className="h-3.5 w-3.5" />
          {r.openTraces}
        </span>
      )}
      {r.companionsCount > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-60">
          <Users className="h-3.5 w-3.5" />
          {r.companionsCount}
        </span>
      )}
      {Number(r.balance) > 0 && r.status === 'checked_in' && (
        <span className="shrink-0 rounded bg-rose-500/15 px-1 text-[10px] font-semibold text-rose-500">
          {Number(r.balance).toFixed(0)}
        </span>
      )}
      {r.houseUse && (
        <span className="shrink-0 rounded bg-slate-400/20 px-1 text-[10px] font-semibold text-slate-400">
          HU
        </span>
      )}
    </div>
  );
}
