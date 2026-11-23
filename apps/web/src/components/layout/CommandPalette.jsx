/* apps/web/src/components/layout/CommandPalette.jsx
 * Blueprint S5 command palette (Phase 3 chassis).
 * - Frecency ranking per user: executions score with a 7-day half-life
 *   decay, stored in localStorage keyed by user id.
 * - Context scoping: items matching the current route rank higher.
 * - Mode prefixes: > actions · @ guests · # rooms/reservations · ? help.
 *   Placeholder text confirms the mode; Backspace on empty input walks back.
 * - Empty query shows recents, never a wall of commands; the AI group is
 *   structurally last and never outranks real commands (no AI items yet).
 * - Active row action panel: Enter opens, Tab copies the label, Esc closes.
 * - Search reuses GET /guests|reservations|rooms|tasks — no new backend.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BedDouble,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Map,
  DollarSign,
  LogIn,
  MessagesSquare,
  MoonStar,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { cn } from '../../lib/utils';
import { guestUrl, LINKS, reservationUrl } from '../../lib/dashLinks';
import { usePermissionChecker } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { NAV_GROUPS } from '../../lib/navGroups';
import { GuestCardDrawer } from '../guests/GuestCardDrawer';

const STORAGE_KEY = 'palette.frecency.v1';
const HALF_LIFE_H = 168; // 7 days

const ACTIONS = [
  {
    label: 'New Reservation',
    perm: 'reservation:create',
    icon: CalendarCheck,
    to: LINKS.newReservation,
    keywords: 'new booking create',
  },
  {
    label: 'Add Guest',
    perm: 'guest:create',
    icon: Users,
    to: '/app/guests',
    keywords: 'new guest create profile',
  },
  {
    label: 'Create Task',
    perm: 'task:create',
    icon: ClipboardList,
    to: LINKS.tasks,
    keywords: 'new task assign department',
  },
  {
    label: 'Message Guest',
    perm: 'sms:send',
    icon: MessagesSquare,
    to: '/app/comms',
    keywords: 'message chat sms email guest',
  },
  {
    label: 'Walk-In Check-in',
    perm: 'reservation:checkin',
    icon: LogIn,
    to: LINKS.arrivalsBoard,
    keywords: 'walkin checkin front desk arrivals',
  },
  {
    label: 'Post Charge / Take Payment',
    perm: 'folio:payment',
    icon: DollarSign,
    to: LINKS.billing,
    keywords: 'folio charge payment billing',
  },
  {
    label: 'Tasks Board',
    perm: 'task:read',
    icon: ClipboardList,
    to: LINKS.tasks,
    keywords: 'tasks spine departments',
  },
  {
    label: 'Night Audit',
    perm: 'night_audit:run',
    icon: MoonStar,
    to: LINKS.nightAudit,
    keywords: 'roll date close day audit',
  },
  {
    label: 'Reports',
    perm: 'report:read',
    icon: TrendingUp,
    to: LINKS.reports,
    keywords: 'reports revenue occupancy',
  },
  {
    label: 'Room Plan / Tape Chart',
    perm: 'reservation:read',
    icon: BedDouble,
    to: LINKS.roomPlan,
    keywords: 'rooms tape chart availability grid',
  },
];

const HELP_ITEMS = [
  { label: 'Support desk', to: '/app/support', keywords: 'help support ticket' },
  { label: 'Onboarding checklist', to: '/app/onboarding', keywords: 'getting started setup' },
];

const PLACEHOLDERS = {
  all: 'Search guests, reservations, rooms, tasks — or type an action…',
  action: '> action — new reservation, walk-in, night audit…',
  guest: '@ guest — name, email, phone…',
  room: '# room or reservation — number, conf #…',
  help: '? help — support, getting started…',
};

const MODES = [
  { prefix: '>', mode: 'action', label: 'Actions' },
  { prefix: '@', mode: 'guest', label: 'Guests' },
  { prefix: '#', mode: 'room', label: 'Rooms & Reservations' },
  { prefix: '?', mode: 'help', label: 'Help' },
];

function loadStore(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return all[userId ?? 'anonymous'] ?? {};
  } catch {
    return {};
  }
}

function saveStore(userId, map) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    all[userId ?? 'anonymous'] = map;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function frecencyScore(rec) {
  if (!rec) return 0;
  const ageH = (Date.now() - rec.last) / 3.6e6;
  return rec.count * Math.pow(2, -ageH / HALF_LIFE_H);
}

export default function CommandPalette({ open, onOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const userId = auth?.user?.id;
  const [query, setQuery] = useState('');
  const [guestHits, setGuestHits] = useState([]);
  const [resHits, setResHits] = useState([]);
  const [roomHits, setRoomHits] = useState([]);
  const [taskHits, setTaskHits] = useState([]);
  const [paymentHits, setPaymentHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [cardGuestId, setCardGuestId] = useState(null);
  const [frecency, setFrecency] = useState(() => loadStore(userId));
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const { mode, term } = useMemo(() => {
    const t = query.trim();
    const m = MODES.find((x) => t.startsWith(x.prefix));
    return m ? { mode: m.mode, term: t.slice(1).trim() } : { mode: 'all', term: t };
  }, [query]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
        else {
          setQuery('');
          setGuestHits([]);
          setResHits([]);
          setRoomHits([]);
          setTaskHits([]);
          setIndex(0);
          onOpen();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpen, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    if (mode === 'action' || mode === 'help' || term.length < 2) {
      setGuestHits([]);
      setResHits([]);
      setRoomHits([]);
      setTaskHits([]);
      setPaymentHits([]);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const [g, r, rm, t, pay] = await Promise.all([
          apiClient.get('/guests', { params: { search: term, pageSize: 5 } }).catch(() => null),
          apiClient
            .get('/reservations', { params: { search: term, pageSize: 5 } })
            .catch(() => null),
          apiClient.get('/rooms', { params: { search: term, pageSize: 5 } }).catch(() => null),
          apiClient.get('/tasks', { params: { q: term, pageSize: 5 } }).catch(() => null),
          apiClient.get('/payments', { params: { pageSize: 50 } }).catch(() => null),
        ]);
        // Endpoints vary in envelope shape: flat | {data:[…]} | paginated {data:{items}}.
        // Endpoints vary in envelope shape: flat | {data:[…]} | {data:{guests|tasks|reservations|items}}.
        // Walk for the first array — every list endpoint wraps its rows in one.
        const asArr = (resp) => {
          const findArr = (x) => {
            if (Array.isArray(x)) return x;
            if (x && typeof x === 'object') {
              for (const v of Object.values(x)) {
                const f = findArr(v);
                if (f) return f;
              }
            }
            return null;
          };
          return findArr(resp?.data) ?? [];
        };
        setPaymentHits(
          asArr(pay)
            .filter((x) =>
              String(x.reference ?? '')
                .toLowerCase()
                .includes(term.toLowerCase())
            )
            .slice(0, 5)
        );
        setGuestHits(mode === 'guest' ? asArr(g) : asArr(g).slice(0, mode === 'all' ? 3 : 0));
        setResHits(asArr(r));
        setRoomHits(asArr(rm));
        setTaskHits(asArr(t));
      } catch {
        setGuestHits([]);
        setResHits([]);
        setRoomHits([]);
        setTaskHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [term, mode, open]);

  const can = usePermissionChecker();

  const openCard = (id) => {
    onClose();
    setCardGuestId(id);
  };
  const copyText = (text) => {
    navigator.clipboard?.writeText(String(text)).catch(() => {});
    setCopied(true);
  };

  const hereBoost = (to) =>
    to && (location.pathname === to || location.pathname.startsWith(to + '/')) ? 1.6 : 1;

  const items = useMemo(() => {
    const q = term.toLowerCase();
    const visibleActions = ACTIONS.filter((a) => !a.perm || can(a.perm)).filter(
      (a) => !q || `${a.label} ${a.keywords}`.toLowerCase().includes(q)
    );
    const actions = visibleActions.map((a) => ({
      ...a,
      key: `action-${a.label}`,
      group: 'Actions',
      score: frecencyScore(frecency[`action-${a.label}`]) * hereBoost(a.to),
    }));

    const pages = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({
        ...i,
        key: `page-${i.to}`,
        icon: Map,
        hint: `${i.group} · page`,
        score: frecencyScore(frecency[`page-${i.to}`]) * hereBoost(i.to),
      }));

    const help = HELP_ITEMS.filter(
      (h) => !q || `${h.label} ${h.keywords}`.toLowerCase().includes(q)
    ).map((h) => ({
      ...h,
      key: `help-${h.to}`,
      icon: MessagesSquare,
      hint: 'help',
      score: frecencyScore(frecency[`page-${h.to}`]) * hereBoost(h.to),
    }));

    const guests = guestHits.map((g) => ({
      key: `guest-${g.id}`,
      label: `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() || 'Guest',
      hint: g.email ?? 'guest',
      icon: Users,
      to: guestUrl(g.id),
      group: 'Guests',
      score: frecencyScore(frecency[`guest-${g.id}`]) * 1.2,
      // Blueprint S5 action panel: never only the primary guess.
      actions: [
        { label: 'Open card', run: () => openCard(g.id) },
        {
          label: 'New reservation',
          run: () => {
            onClose();
            navigate('/app/reservations/new');
          },
        },
        {
          label: 'Message',
          run: () => {
            onClose();
            navigate('/app/comms');
          },
        },
        {
          label: 'Copy contact',
          run: () => copyText(g.phone ?? g.email ?? `${g.firstName ?? ''} ${g.lastName ?? ''}`),
        },
      ],
    }));
    const res = resHits.map((r) => ({
      key: `res-${r.id}`,
      label: r.guestName ?? r.confirmationNumber ?? 'Reservation',
      hint: `${r.confirmationNumber ?? ''}${r.status ? ` · ${r.status.replace('_', ' ')}` : ''}`,
      icon: CalendarCheck,
      to: reservationUrl(r.id),
      group: 'Reservations',
      score: frecencyScore(frecency[`res-${r.id}`]),
    }));
    const rooms = roomHits.map((rm) => ({
      key: `room-${rm.id}`,
      label: `Room ${rm.number}`,
      hint: [rm.floor ? `floor ${rm.floor}` : null, rm.status].filter(Boolean).join(' · '),
      icon: BedDouble,
      to: `/app/rooms?room=${encodeURIComponent(rm.number)}`,
      group: 'Rooms',
      score: frecencyScore(frecency[`room-${rm.id}`]),
    }));
    const payments = paymentHits.map((p) => ({
      key: `pay-${p.id}`,
      label: p.reference,
      hint: `${p.guest ? `${p.guest.firstName} ${p.guest.lastName}` : 'Payment'} · ${String(
        p.status ?? ''
      ).replace(/_/g, ' ')}`,
      icon: CreditCard,
      to: '/app/billing/payments',
      group: 'Payments',
      score: frecencyScore(frecency[`pay-${p.id}`]),
    }));
    const tasks = taskHits.map((t) => ({
      key: `task-${t.id}`,
      label: t.title,
      hint: `task · ${String(t.status).replace('_', ' ')}`,
      icon: ClipboardList,
      to: '/app/tasks',
      group: 'Tasks',
      score: frecencyScore(frecency[`task-${t.id}`]),
    }));

    const pools = {
      action: [...actions],
      guest: [...guests],
      room: [...rooms, ...res, ...payments],
      help: [...help],
      all: [...actions, ...guests, ...res, ...rooms, ...payments, ...tasks, ...pages, ...help],
    };
    let list = pools[mode] ?? pools.all;

    // Empty query: recents only (top 8 by frecency), never a wall of commands.
    if (!q && mode === 'all') {
      list = [...actions, ...pages].sort((a, b) => b.score - a.score).slice(0, 8);
    } else {
      list = [...list].sort((a, b) => b.score - a.score);
    }
    return list;
  }, [
    term,
    mode,
    guestHits,
    resHits,
    roomHits,
    taskHits,
    paymentHits,
    can,
    frecency,
    location.pathname,
  ]);

  useEffect(() => setIndex(0), [items.length, query]);
  useEffect(() => setCopied(false), [index, query]);

  // Drawer must render even when the palette is closed — it opens after onClose.
  if (!open)
    return (
      <GuestCardDrawer
        guestId={cardGuestId}
        open={!!cardGuestId}
        onClose={() => setCardGuestId(null)}
      />
    );

  const record = (item) => {
    const next = {
      ...frecency,
      [item.key]: { count: (frecency[item.key]?.count ?? 0) + 1, last: Date.now() },
    };
    setFrecency(next);
    saveStore(userId, next);
  };

  const go = (item) => {
    if (!item?.to) return;
    record(item);
    onClose();
    navigate(item.to);
  };

  const copyActive = () => {
    const item = items[index];
    if (!item) return;
    navigator.clipboard?.writeText(item.label).catch(() => {});
    setCopied(true);
  };

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (/^[1-9]$/.test(e.key)) {
      const act = items[index]?.actions?.[Number(e.key) - 1];
      if (act) {
        e.preventDefault();
        act.run();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[index]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      copyActive();
    } else if (e.key === 'Backspace' && query === '' && mode !== 'all') {
      e.preventDefault();
      setQuery(''); // walk back: clear the mode prefix
      setIndex(0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const groupOrder = [
    'Actions',
    'Guests',
    'Reservations',
    'Rooms',
    'Payments',
    'Tasks',
    'Pages',
    'Help',
  ];
  const ordered = [...items].sort(
    (a, b) =>
      (groupOrder.indexOf(a.group) + 1 || 99) - (groupOrder.indexOf(b.group) + 1 || 99) ||
      b.score - a.score
  );

  let lastGroup = null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--hq-hairline)', background: 'var(--hq-surface-1)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div
          className="flex items-center gap-2 border-b px-4"
          style={{ borderColor: 'var(--hq-hairline)' }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          {mode !== 'all' && (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ background: 'var(--hq-accent-soft)', color: 'var(--primary)' }}
            >
              {MODES.find((m) => m.mode === mode)?.prefix}{' '}
              {MODES.find((m) => m.mode === mode)?.label}
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={PLACEHOLDERS[mode]}
            className="w-full bg-transparent py-3 text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd className="hq-keycap">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-auto p-2" role="listbox">
          {ordered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {searching ? 'Searching…' : 'No matches — try a name, conf #, or action'}
            </p>
          ) : (
            ordered.map((item, i) => {
              const Icon = item.icon;
              const showHeader = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.key}>
                  {showHeader && (
                    <div
                      className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {item.group}
                    </div>
                  )}
                  <button
                    data-active={i === index}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(item)}
                    role="option"
                    aria-selected={i === index}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
                      i === index ? 'bg-[var(--hq-accent-soft)]' : 'hover:bg-[var(--hq-surface-2)]'
                    )}
                  >
                    <span
                      className="rounded-md p-1.5"
                      style={{ background: 'var(--hq-surface-2)' }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.label}
                      </span>
                      {item.hint && (
                        <span
                          className="block truncate text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {item.hint}
                        </span>
                      )}
                    </span>
                    {i === index && (
                      <kbd className="shrink-0">
                        <span className="hq-keycap">↵</span>
                      </kbd>
                    )}
                  </button>
                  {i === index && item.actions && (
                    <div className="mb-1 ml-9 mt-0.5 flex flex-wrap gap-1">
                      {item.actions.map((a, ai) => (
                        <button
                          key={a.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            a.run();
                          }}
                          className="rounded-md px-2 py-1 text-[11px]"
                          style={{
                            background: 'var(--hq-surface-2)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span className="hq-keycap mr-1">{ai + 1}</span>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div
          className="flex items-center justify-between border-t px-4 py-2 text-[11px]"
          style={{ borderColor: 'var(--hq-hairline)', color: 'var(--text-muted)' }}
        >
          <span>&gt; actions · @ guests · # rooms · ? help</span>
          <span>{copied ? 'Copied' : '↵ open · 1-4 row actions · tab copy · esc'}</span>
        </div>
      </div>

      <GuestCardDrawer
        guestId={cardGuestId}
        open={!!cardGuestId}
        onClose={() => setCardGuestId(null)}
      />
    </div>
  );
}
