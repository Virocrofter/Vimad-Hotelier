import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { useGuest } from '../../../../hooks/useGuests';
import { Button } from '@/components/ui/button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { GuestCard } from '../../../../components/guests/GuestCard';

export default function GuestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: guest, isLoading, error } = useGuest(id);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !guest) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/app/guests')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Guests
        </Button>
        <EmptyState
          icon={AlertTriangle}
          title="Guest not found"
          description={error?.message || 'This guest may have been deleted.'}
          action={<Button onClick={() => navigate('/app/guests')}>Go to Guests</Button>}
        />
      </div>
    );
  }

  return <GuestCard guest={guest} showBack />;
}
