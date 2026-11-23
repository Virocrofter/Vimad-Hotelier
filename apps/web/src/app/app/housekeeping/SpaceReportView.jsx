/* apps/web/src/app/app/housekeeping/SpaceReportView.jsx — 7.2/7.3
 * Supervisor space-status report: rooms grouped by floor with status counts,
 * attendant context and next arrivals — plus the arrival-urgency strip and a
 * print-ready clipboard sheet.
 */
import { useSpaceReport } from '../../../hooks/useSupervisor';
import { usePropertyScope } from '../../../hooks/usePropertyScope';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Printer, AlertTriangle } from 'lucide-react';

const TONE = {
  ready: 'bg-emerald-100 text-emerald-800',
  dirty: 'bg-amber-100 text-amber-800',
  inspected: 'bg-blue-100 text-blue-800',
  blocked: 'bg-red-100 text-red-800',
};
const pill = (k) => TONE[k] ?? 'bg-gray-100 text-gray-700';

export default function SpaceReportView() {
  const { current } = usePropertyScope();
  const { data, isLoading, isError } = useSpaceReport(current?.id);
  const report = data?.data ?? {};

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !report.floors)
    return (
      <EmptyState
        title="Space report unavailable"
        description="Check the API and property scope."
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-lg font-semibold">Space report — {report.totalRooms} rooms</h2>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print sheet
        </Button>
      </div>

      {report.urgentCount > 0 && (
        <Card className="border-amber-300 bg-amber-50 print:hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {report.urgentCount} room{report.urgentCount === 1 ? '' : 's'} must be serviced before
              arrival
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pb-3">
            {report.urgent.map((r) => (
              <Badge key={r.id} variant="outline" className="bg-white">
                {r.number} · {r.nextArrival}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {report.floors.map((f) => (
        <Card key={f.floor}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Floor {f.floor}</span>
              <span className="flex gap-1">
                {Object.entries(f.counts).map(([k, v]) => (
                  <Badge key={k} className={pill(k)}>
                    {v} {k}
                  </Badge>
                ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1">Room</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Next arrival</th>
                  <th>Attendant</th>
                </tr>
              </thead>
              <tbody>
                {f.rooms.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1 font-medium">{r.number}</td>
                    <td>{r.category ?? '—'}</td>
                    <td>
                      <Badge
                        className={pill(
                          r.serviceStatus !== 'active' ? 'blocked' : r.housekeepingStatus
                        )}
                      >
                        {r.serviceStatus !== 'active'
                          ? `Blocked (${r.serviceStatus})`
                          : r.housekeepingStatus}
                      </Badge>
                    </td>
                    <td>{r.nextArrival ?? '—'}</td>
                    <td>{r.attendantId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
