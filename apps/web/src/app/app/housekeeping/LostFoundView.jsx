/* apps/web/src/app/app/housekeeping/LostFoundView.jsx — 7.8
 * Lost & Found ledger: register found items, drive the lifecycle
 * found → claimed → returned | disposed, filter by status.
 */
import { useState } from 'react';
import { useLostFound, useLostFoundMutations } from '../../../hooks/useSupervisor';
import { usePropertyScope } from '../../../hooks/usePropertyScope';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Textarea } from '../../../components/ui/textarea';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { toast } from '../../../hooks/use-toast';
import { PackagePlus } from 'lucide-react';

const NEXT = { found: ['claimed', 'disposed'], claimed: ['returned'] };
const TONE = {
  found: 'bg-blue-100 text-blue-800',
  claimed: 'bg-amber-100 text-amber-800',
  returned: 'bg-emerald-100 text-emerald-800',
  disposed: 'bg-gray-200 text-gray-700',
};
const EMPTY = { description: '', category: 'general', foundLocation: '', photoUrl: '', notes: '' };

export default function LostFoundView() {
  const { current } = usePropertyScope();
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { data, isLoading } = useLostFound({
    propertyId: current?.id || '',
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const mutate = useLostFoundMutations();
  const items = data?.data?.items ?? [];

  const register = async () => {
    try {
      await mutate.mutateAsync({
        propertyId: current.id,
        description: form.description,
        category: form.category,
        foundLocation: form.foundLocation || undefined,
        photoUrls: form.photoUrl ? [form.photoUrl] : undefined,
        notes: form.notes || undefined,
      });
      toast({ title: 'Item registered' });
      setOpen(false);
      setForm(EMPTY);
    } catch (e) {
      toast({ title: 'Register failed', description: e.message, variant: 'destructive' });
    }
  };

  const transition = async (id, status) => {
    try {
      await mutate.mutateAsync({ id, status });
      toast({ title: `Marked ${status}` });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="found">Found</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setOpen(true)}>
          <PackagePlus className="mr-2 h-4 w-4" /> Register item
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No items" description="Register a found item to start the ledger." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="truncate">{it.description}</span>
                  <Badge className={TONE[it.status]}>{it.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  {it.category} · {it.foundRoom?.number ?? it.foundLocation ?? '—'} · found{' '}
                  {it.foundAt?.slice(0, 10)}
                </div>
                {it.guest && (
                  <div>
                    Linked guest: {it.guest.firstName} {it.guest.lastName}
                  </div>
                )}
                {it.reservation && <div>Reservation: {it.reservation.confirmationNumber}</div>}
                {it.photoUrls?.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {it.photoUrls.length} photo(s)
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {(NEXT[it.status] ?? []).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      onClick={() => transition(it.id, s)}
                    >
                      Mark {s}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register found item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="lf-desc">Description</Label>
              <Textarea
                id="lf-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['general', 'electronics', 'clothing', 'documents', 'valuables'].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lf-loc">Found location</Label>
              <Input
                id="lf-loc"
                value={form.foundLocation}
                onChange={(e) => setForm({ ...form, foundLocation: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lf-photo">Photo URL (optional)</Label>
              <Input
                id="lf-photo"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lf-notes">Notes</Label>
              <Textarea
                id="lf-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={register} disabled={!form.description || mutate.isPending}>
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
