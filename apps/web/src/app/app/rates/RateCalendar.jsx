/* apps/web/src/app/app/rates/RateCalendar.jsx */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingDown,
  TrendingUp,
  DollarSign,
  BedDouble,
  CheckSquare,
} from 'lucide-react';
import { listRoomTypes } from '../../../api/room-types';
import { listRatePlans, listCellOverrides, setCellOverride } from '../../../api/rates-api';
import { apiDelete } from '../../../api/client';
import {
  formatDate,
  formatShortDay,
  heatClass,
  getCellRate,
  planForDate,
  isWeekend,
} from './RateUtils';

export default function RateCalendar() {
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [editing, setEditing] = useState(null); // { rtId, date } — the cell being edited
  const [draft, setDraft] = useState('');
  const queryClient = useQueryClient();

  const { data: roomTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ['room-types'],
    queryFn: () => listRoomTypes(),
  });

  const { data: ratePlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['rate-plans'],
    queryFn: () => listRatePlans({ pageSize: 100 }),
  });

  const isLoading = loadingTypes || loadingPlans;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dates = useMemo(() => {
    const result = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i + dateOffset);
      result.push(date.toISOString().split('T')[0]);
    }
    return result;
  }, [today, dateOffset]);

  // Manual overrides for the visible window (blueprint: rate change <=3 clicks)
  const { data: overrides = [] } = useQuery({
    queryKey: ['rate-cell-overrides', dates[0], dates[dates.length - 1]],
    queryFn: () => listCellOverrides({ from: dates[0], to: dates[dates.length - 1] }),
  });

  const overrideMap = useMemo(() => {
    const m = new Map();
    overrides.forEach((o) =>
      m.set(`${o.ratePlanId}|${o.date.slice(0, 10)}`, Number(o.effectiveRate))
    );
    return m;
  }, [overrides]);

  const saveOverride = useMutation({
    mutationFn: ({ ratePlanId, date, rate, propertyId }) =>
      setCellOverride({ ratePlanId, date, rate, propertyId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rate-cell-overrides'] }),
  });

  const clearOverride = useMutation({
    mutationFn: ({ ratePlanId, date }) =>
      apiDelete(`/v1/rates/overrides/cell?ratePlanId=${ratePlanId}&date=${date}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rate-cell-overrides'] }),
  });

  // Single source of truth: effective cell for a room type + date.
  // Manual override wins; stats, CSV export, and the grid all resolve here.
  const resolveCell = (rt, date) => {
    const plan = planForDate(ratePlans, rt.id, date);
    if (!plan) return null;
    const ov = overrideMap.get(`${plan.id}|${date}`);
    if (ov !== undefined) {
      return {
        rate: ov,
        minStay: plan.minStay ?? 1,
        weekend: isWeekend(date),
        currency: plan.currency ?? 'ZAR',
        overridden: true,
      };
    }
    return getCellRate(ratePlans, rt.id, date);
  };

  const filteredRoomTypes =
    selectedRoomType === 'all' ? roomTypes : roomTypes.filter((rt) => rt.id === selectedRoomType);

  // Base rate per room type = cheapest plan rate
  const baseRateByType = useMemo(() => {
    const map = {};
    roomTypes.forEach((rt) => {
      const plans = ratePlans.filter((p) => p.roomTypeId === rt.id);
      map[rt.id] = plans.length ? Math.min(...plans.map((p) => Number(p.baseRate))) : null;
    });
    return map;
  }, [roomTypes, ratePlans]);

  // Stats across all visible cells
  const stats = useMemo(() => {
    const rates = [];
    filteredRoomTypes.forEach((rt) => {
      dates.forEach((d) => {
        const cell = resolveCell(rt, d);
        if (cell) rates.push(cell.rate);
      });
    });
    if (!rates.length) return { min: 0, max: 0, avg: 0 };
    return {
      min: Math.min(...rates),
      max: Math.max(...rates),
      avg: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
    };
  }, [filteredRoomTypes, dates, ratePlans, overrideMap]);

  const exportCsv = () => {
    const header = [
      'Room Type',
      'Code',
      'Date',
      'Rate',
      'Currency',
      'Min Stay',
      'Weekend',
      'Override',
    ];
    const rows = [];
    filteredRoomTypes.forEach((rt) => {
      dates.forEach((d) => {
        const cell = resolveCell(rt, d);
        if (cell) {
          rows.push([
            rt.name,
            rt.code,
            d,
            cell.rate,
            cell.currency,
            cell.minStay,
            cell.weekend,
            cell.overridden ? 'yes' : '',
          ]);
        }
      });
    });
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rates-${dates[0]}-to-${dates[dates.length - 1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: 'Min Rate', value: stats.min, icon: TrendingDown, accent: 'text-accent' },
    { label: 'Max Rate', value: stats.max, icon: TrendingUp, accent: 'text-danger' },
    {
      label: 'Avg Rate',
      value: stats.avg,
      icon: DollarSign,
      accent: 'text-primary',
      revenue: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Navigation + Filter */}
      <div className="flex items-center justify-between bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateOffset((prev) => prev - 14)}
            className="flex items-center justify-center h-8 w-8 border border-border rounded-md text-text-secondary hover:bg-surface-elevated"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 px-2">
            <Calendar className="h-4 w-4 text-text-secondary" />
            <span className="font-medium text-text-primary text-sm">
              {formatDate(dates[0])} — {formatDate(dates[dates.length - 1])}
            </span>
          </div>
          <button
            onClick={() => setDateOffset((prev) => prev + 14)}
            className="flex items-center justify-center h-8 w-8 border border-border rounded-md text-text-secondary hover:bg-surface-elevated"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDateOffset(0)}
            className="ml-2 px-3 py-1.5 text-sm border border-border rounded-md text-text-secondary hover:bg-surface-elevated"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedRoomType('all')}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-elevated"
          >
            <CheckSquare className="h-4 w-4" />
            Select All
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-elevated"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <select
            value={selectedRoomType}
            onChange={(e) => setSelectedRoomType(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-surface text-sm text-text-primary"
          >
            <option value="all">All Room Types</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, accent, revenue }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {label}
              </span>
              <Icon className={`h-4 w-4 ${accent}`} />
            </div>
            <p
              className={`text-3xl font-semibold mt-1 tabular-nums ${
                revenue ? 'hq-revenue' : 'text-text-primary'
              }`}
            >
              {isLoading ? '—' : `$${value}`}
            </p>
          </div>
        ))}
      </div>

      {/* Heat Legend */}
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="font-medium">Rate Heat Map</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/60" /> Below Base
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent/60" /> Base
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning/60" /> Premium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/60" /> Peak
        </span>
      </div>

      {/* Rates Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-surface px-4 py-3 text-left font-medium text-text-secondary min-w-40">
                Room Type / Date
              </th>
              {dates.map((date) => {
                const { dow, day, weekend } = formatShortDay(date);
                return (
                  <th
                    key={date}
                    className={`px-2 py-3 text-center font-medium min-w-20 ${
                      weekend ? 'text-warning' : 'text-text-secondary'
                    }`}
                  >
                    <div>{dow}</div>
                    <div className="text-xs font-normal opacity-80">{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={dates.length + 1} className="px-4 py-12 text-center text-text-muted">
                  Loading rates…
                </td>
              </tr>
            )}
            {!isLoading && filteredRoomTypes.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1} className="px-4 py-12 text-center text-text-muted">
                  No room types found. Add room types and rate plans to see the calendar.
                </td>
              </tr>
            )}
            {!isLoading &&
              filteredRoomTypes.map((rt) => {
                const base = baseRateByType[rt.id];
                return (
                  <tr key={rt.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 bg-surface px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BedDouble className="h-4 w-4 text-text-muted shrink-0" />
                        <div>
                          <p className="font-medium text-text-primary">{rt.name}</p>
                          <p className="text-xs text-text-muted">
                            Base {base != null ? `$${base}` : '—'} · {rt.code}
                          </p>
                        </div>
                      </div>
                    </td>
                    {dates.map((date) => {
                      const plan = planForDate(ratePlans, rt.id, date);
                      const cell = resolveCell(rt, date);
                      const ov = plan ? overrideMap.get(`${plan.id}|${date}`) : undefined;
                      if (!cell || !plan) {
                        return (
                          <td key={date} className="px-1.5 py-2 text-center">
                            <span className="text-xs text-text-muted">—</span>
                          </td>
                        );
                      }
                      const isEditing = editing && editing.rtId === rt.id && editing.date === date;
                      return (
                        <td key={date} className="relative px-1.5 py-2 text-center">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const rate = Number(draft);
                                  if (rate > 0) {
                                    saveOverride.mutate({
                                      ratePlanId: plan.id,
                                      date,
                                      rate,
                                      propertyId: plan.propertyId,
                                    });
                                  }
                                  setEditing(null);
                                } else if (e.key === 'Escape') {
                                  setEditing(null);
                                }
                              }}
                              onBlur={() => setEditing(null)}
                              className="w-16 rounded-md border border-[#F453A4] bg-surface px-1 py-1 text-center text-sm tabular-nums outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditing({ rtId: rt.id, date });
                                setDraft(String(cell.rate));
                              }}
                              title="Click to set rate (click, type, Enter)"
                              className={`w-full rounded-lg px-2 py-1.5 ${heatClass(cell.rate, base)} ${
                                ov !== undefined ? 'ring-1 ring-[#F453A4]' : ''
                              }`}
                            >
                              <p className="font-semibold tabular-nums">${cell.rate}</p>
                              {cell.minStay > 1 && (
                                <p className="text-[10px] opacity-80">min {cell.minStay}</p>
                              )}
                            </button>
                          )}
                          {ov !== undefined && !isEditing && (
                            <span
                              role="button"
                              tabIndex={0}
                              title="Clear override (back to base rate)"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearOverride.mutate({ ratePlanId: plan.id, date });
                              }}
                              className="absolute right-0 top-0 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-[#F453A4] text-[9px] font-bold text-white"
                            >
                              ×
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
