/* SH-01 global create menu (Stage 6, plan SH-01): permission-aware create
 * actions, shell-wide via Topbar. UI filtering only - the server enforces. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  MessageSquare,
  Plus,
  Users,
} from 'lucide-react';
import { usePermissionChecker } from '../../hooks/usePermissions';
import { LINKS } from '../../lib/dashLinks';

const ITEMS = [
  {
    label: 'New reservation',
    perm: 'reservation:create',
    to: LINKS.newReservation,
    Icon: CalendarCheck,
  },
  { label: 'Add guest', perm: 'guest:create', to: '/app/guests', Icon: Users },
  { label: 'Create task', perm: 'task:create', to: LINKS.tasks, Icon: ClipboardList },
  { label: 'Record payment', perm: 'folio:payment', to: LINKS.billing, Icon: DollarSign },
  { label: 'Charge to room', perm: 'folio:create', to: LINKS.chargeToRoom, Icon: BedDouble },
  { label: 'Message guest', perm: 'ticket:update', to: LINKS.comms, Icon: MessageSquare },
];

export default function GlobalCreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const can = usePermissionChecker();
  const allowed = (p?: string) => !p || can(p);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const items = ITEMS.filter((i) => allowed(i.perm));
  if (!items.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Create"
        title="Create"
        className="rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
      >
        <Plus className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="p-1.5">
            {items.map(({ label, to, Icon }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
