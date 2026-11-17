/* apps/web/src/lib/offices.ts
 * Office Setups as code constants (plan section 5.1 / 9.1). No API calls, no
 * components: IDs, labels, lenses, departments, role priority, destinations.
 * Housekeeping entry mirrors the shipped Stage 5 office; front is Stage 6.
 */
export type LensId =
  | 'task-sheet'
  | 'board'
  | 'my-shift'
  | 'shift-load'
  | 'turnover-chain'
  | 'tape'
  | 'mass-update'
  | 'suggestion-queue';

export interface OfficeSetup {
  id: string;
  label: string;
  department: string;
  route: string;
  flag: string;
  lenses: { id: LensId; label: string }[];
  shiftReport: string[];
  rolePriority: string[];
}

export const OFFICES: OfficeSetup[] = [
  {
    id: 'housekeeping',
    label: 'Housekeeping',
    department: 'housekeeping',
    route: '/app/housekeeping',
    flag: 'housekeeping.v2',
    lenses: [
      { id: 'task-sheet', label: 'Task Sheet' },
      { id: 'board', label: 'Board' },
      { id: 'shift-load', label: 'Shift Load' },
      { id: 'my-shift', label: 'My Shift' },
      { id: 'turnover-chain', label: 'Turnover Chain' },
    ],
    shiftReport: ['Rooms to clean', 'Inspected ready', 'SLA breaches', 'Attendants active'],
    rolePriority: ['housekeeping_supervisor', 'room_attendant', 'owner'],
  },
  {
    id: 'front',
    label: 'Front Office',
    department: 'front_office',
    route: '/app/offices/front',
    flag: 'offices.front',
    lenses: [
      { id: 'tape', label: 'Tape' },
      { id: 'task-sheet', label: 'Arrivals & Departures' },
      { id: 'my-shift', label: 'My Shift' },
    ],
    shiftReport: ['Arrivals', 'Departures', 'In house', 'VIPs', 'Needs Attention'],
    rolePriority: ['front_desk', 'concierge', 'owner'],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    department: 'maintenance',
    route: '/app/offices/maintenance',
    flag: 'offices.maintenance',
    lenses: [
      { id: 'task-sheet', label: 'Work Orders' },
      { id: 'board', label: 'Board' },
      { id: 'my-shift', label: 'My Shift' },
    ],
    shiftReport: ['Open work orders', 'SLA breaches', 'Due today', 'Completed today'],
    rolePriority: ['maintenance', 'staff', 'owner'],
  },
];

export const officeById = (id: string): OfficeSetup | undefined => OFFICES.find((o) => o.id === id);
