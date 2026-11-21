/* /app/keys — V1-prime: room key/card issuance registry. Issue at check-in,
 * return at check-out, mark lost. Status-first, blueprint chrome. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, CornerDownLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePropertyScope } from '../../../hooks/usePropertyScope';
import { apiClient } from '../../../api/client';
import { keysApi } from '../../../api/keys';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'lost', label: 'Lost' },
];

export default function KeysPage() {
  const { current } = usePropertyScope();
  const propertyId = current?.id;
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [roomId, setRoomId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  const { data: issuances = [], isLoading } = useQuery({
    queryKey: ['keys', propertyId, status],
    queryFn: () => keysApi.list(propertyId),
    enabled: Boolean(propertyId),
  });

  const { data: roomsData } = useQuery({
    queryKey: ['keys-rooms', propertyId],
    queryFn: () => apiClient.get('/rooms', { params: { propertyId, pageSize: 100 } }),
    enabled: Boolean(propertyId),
  });
  const rooms = roomsData?.data?.data ?? roomsData?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['keys', propertyId] });

  const issue = useMutation({
    mutationFn: (input) => keysApi.issue(input),
    onSuccess: () => {
      setRoomId('');
      setGuestName('');
      setNotes('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err?.response?.data?.error?.message ?? 'Issue failed'),
  });
  const returnKey = useMutation({
    mutationFn: (id) => keysApi.returnKey(id),
    onSuccess: invalidate,
  });
  const markLost = useMutation({ mutationFn: (id) => keysApi.markLost(id), onSuccess: invalidate });

  const submit = () => {
    if (!roomId) return;
    issue.mutate({
      roomId,
      guestName: guestName.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const filtered = status ? issuances.filter((i) => i.status === status) : issuances;

  return (
    <div className="hq-surface-0 min-h-full space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold">Keys</h1>
        <p className="text-sm text-text-muted">
          Key/card issuance by room — issue, return, mark lost.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue a key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="">Select room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number}
                </option>
              ))}
            </select>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name (optional)"
              className="h-8 w-48 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="h-8 w-48 rounded-md border border-border bg-background px-2 text-xs text-text-primary"
            />
            <Button size="sm" onClick={submit} disabled={issue.isPending || !roomId}>
              <KeyRound className="mr-1 h-3.5 w-3.5" /> Issue key
            </Button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Status
        </span>
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={
              status === t.value
                ? 'rounded-full bg-[var(--hq-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--primary)]'
                : 'rounded-full border px-2.5 py-1 text-xs text-text-secondary'
            }
            style={status === t.value ? undefined : { borderColor: 'var(--hq-hairline)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={status ? `No ${status} keys` : 'No keys issued yet'}
          description="Issue a key above — entries appear here with return and lost tracking."
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtered.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-20 font-medium text-text-primary">
                  Room {i.room?.number ?? '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {i.guestName ?? '—'}
                  <span className="ml-2 text-xs text-text-muted">
                    by {i.issuerName} ·{' '}
                    {new Date(i.issuedAt).toLocaleString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <Badge
                  className={
                    i.status === 'active'
                      ? 'bg-warning/25 text-[var(--warning-soft-fg)]'
                      : i.status === 'lost'
                        ? 'bg-danger/25 text-[var(--danger-soft-fg)]'
                        : 'bg-muted text-muted-foreground'
                  }
                >
                  {i.status}
                </Badge>
                {i.status === 'active' && (
                  <span className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px]"
                      disabled={returnKey.isPending}
                      onClick={() => returnKey.mutate(i.id)}
                    >
                      <CornerDownLeft className="mr-1 h-3 w-3" /> Return
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-danger"
                      disabled={markLost.isPending}
                      onClick={() => markLost.mutate(i.id)}
                    >
                      <HelpCircle className="mr-1 h-3 w-3" /> Lost
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
