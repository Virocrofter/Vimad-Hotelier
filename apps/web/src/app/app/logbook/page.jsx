/* /app/logbook — shift logbook: chronological handover notes per property.
 * Blueprint: overview first (timeline), one-click compose, real empty state. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePropertyScope } from '../../../hooks/usePropertyScope';
import { logbookApi } from '../../../api/logbook';

const CATEGORIES = ['general', 'shift', 'maintenance', 'guest', 'incident'];
const SHIFTS = ['morning', 'afternoon', 'night'];

export default function LogbookPage() {
  const { current } = usePropertyScope();
  const propertyId = current?.id;
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [shift, setShift] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['logbook', propertyId],
    queryFn: () => logbookApi.list(propertyId),
    enabled: Boolean(propertyId),
  });

  const add = useMutation({
    mutationFn: (input) => logbookApi.create(input),
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['logbook', propertyId] });
    },
  });

  const submit = () => {
    if (message.trim().length < 2 || !propertyId) return;
    add.mutate({ propertyId, category, message: message.trim(), shift: shift || undefined });
  };

  return (
    <div className="hq-surface-0 min-h-full space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold">Logbook</h1>
        <p className="text-sm text-text-muted">
          Shift handover notes — who did what, what to watch.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="Log an entry… (⌘/Ctrl+Enter to post)"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="">shift (optional)</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={submit}
              disabled={add.isPending || message.trim().length < 2}
            >
              <Send className="mr-1 h-3.5 w-3.5" /> Post entry
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No entries yet"
          description="The logbook starts with the first handover note — post above."
        />
      ) : (
        <ol className="relative ml-2 space-y-3 border-l border-border pl-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span
                className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full bg-accent"
                aria-hidden="true"
              />
              <p className="whitespace-pre-wrap text-sm text-text-primary">{e.message}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {e.authorName} · {e.category}
                {e.shift ? ` · ${e.shift} shift` : ''} ·{' '}
                {new Date(e.createdAt).toLocaleString('en-ZA', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
