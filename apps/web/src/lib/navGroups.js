/* apps/web/src/lib/navGroups.js
 * Blueprint S4 chassis map (Phase 3, 2026-11-18): rail-and-flyout groups,
 * <=6 items each, permission-projected by the sidebar. LINKS ONLY: every
 * route here already exists in the app — this file decides where users FIND
 * it. Group order = task frequency. Naming is binding: Inbox (not Comms),
 * Tape Chart (not Room Plan/calendar). Needs Attention is NOT a nav item —
 * it lives in the topbar alert cluster (P3.1b) and links to /app/exceptions.
 */
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  LineChart,
  Wallet,
  Building2,
  BarChart3,
  Users,
  Store,
  Settings,
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    key: 'command',
    label: 'Command Center',
    icon: LayoutDashboard,
    items: [{ label: 'Dashboard', to: '/app/dashboard' }],
  },
  {
    key: 'front-desk',
    label: 'Front Desk',
    icon: CalendarDays,
    items: [
      { label: 'Tape Chart', to: '/app/room-plan' },
      { label: 'Reservations', to: '/app/reservations' },
      { label: 'Guests', to: '/app/guests' },
      { label: 'Groups & Events', to: '/app/groups' },
      { label: 'Concierge', to: '/app/concierge' },
      { label: 'Inbox', to: '/app/comms' },
    ],
  },
  {
    key: 'house-ops',
    label: 'House Ops',
    icon: BedDouble,
    items: [
      { label: 'Housekeeping', to: '/app/housekeeping' },
      { label: 'Tickets', to: '/app/tasks' },
      { label: 'Night Audit', to: '/app/night-audit' },
      { label: 'Logbook', to: '/app/logbook' },
      // Logbook lands here with its engine (master plan Phase 6)
    ],
  },
  {
    key: 'revenue',
    label: 'Revenue',
    roles: ['owner', 'admin', 'chain_admin'],
    icon: LineChart,
    items: [
      { label: 'Rates & Availability', to: '/app/rates' },
      { label: 'Inventory', to: '/app/inventory' },
      { label: 'Channels', to: '/app/channel-manager' },
      // Upsells (U1-prime) + Booking Engine config land here in Phase 8
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    roles: ['owner', 'admin', 'chain_admin'],
    icon: Wallet,
    items: [
      { label: 'Folios & Billing', to: '/app/billing' },
      { label: 'Payments', to: '/app/billing/payments' },
      { label: 'Payment Requests', to: '/app/billing/payment-requests' },
      { label: 'Invoices', to: '/app/billing/invoices' },
      { label: 'AR', to: '/app/ar' },
      { label: 'VCC', to: '/app/vcc' },
    ],
  },
  {
    key: 'chain',
    label: 'Chain',
    icon: Building2,
    context: 'chain',
    roles: ['chain_admin', 'admin'],
    items: [
      { label: 'Chain Overview', to: '/app/chain-dashboard' },
      { label: 'Central Reservations', to: '/app/central-reservations' },
      { label: 'Chain Loyalty', to: '/app/chain-loyalty' },
      { label: 'Properties', to: '/app/properties' },
    ],
  },
  {
    key: 'insight',
    label: 'Insight',
    roles: ['owner', 'admin', 'chain_admin'],
    icon: BarChart3,
    items: [{ label: 'Reports', to: '/app/reports' }],
  },
  {
    key: 'grow',
    label: 'Grow',
    roles: ['owner', 'admin'],
    icon: Users,
    items: [
      { label: 'CRM', to: '/app/crm' },
      { label: 'Loyalty', to: '/app/loyalty' },
      { label: 'Marketing', to: '/app/marketing' },
    ],
  },
  {
    key: 'property',
    label: 'Property',
    roles: ['owner', 'admin', 'chain_admin'],
    icon: Store,
    items: [
      { label: 'Rooms', to: '/app/rooms' },
      { label: 'Meal Plans', to: '/app/meal-plans' },
      { label: 'Parking', to: '/app/parking' },
      { label: 'Sales & Catering', to: '/app/sales-catering' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    roles: ['owner', 'admin'],
    icon: Settings,
    items: [
      { label: 'Settings', to: '/app/settings' },
      { label: 'Onboarding', to: '/app/onboarding' },
      { label: 'Audit Trail', to: '/app/audit-trail' },
      { label: 'Users', to: '/app/users' },
      { label: 'Support', to: '/app/support' },
      // Settings becomes a separate mode with its own left nav (4-menu model)
    ],
  },
];
