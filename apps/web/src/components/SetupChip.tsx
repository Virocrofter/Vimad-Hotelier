import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export default function SetupChip() {
  const { pathname } = useLocation();
  const q = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: () => api.get('/v1/onboarding-progress'),
    staleTime: 30000,
  });
  const p = (q.data as any)?.data ?? {};
  if (q.isLoading || p.status === 'done' || pathname.startsWith('/app/onboarding')) return null;
  return (
    <Link
      to="/app/onboarding"
      className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 hq-text-caption text-text-secondary hover:bg-surface-elevated"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      Setup {p.percent ?? 0}%
    </Link>
  );
}
