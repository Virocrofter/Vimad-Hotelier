import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/* First-run front door (addendum #9 + founder decision 2026-11-15): fresh
 * tenants (suggested) land on the wizard. Dismiss is respected. Never a
 * blocking modal - a plain redirect only while onboarding is incomplete. */
export default function OnboardingGate() {
  const { pathname } = useLocation();
  const q = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: () => api.get('/v1/onboarding-progress'),
    staleTime: 30000,
  });
  if (q.isLoading) return null;
  const p = (q.data as any)?.data ?? {};
  if (p.suggested && p.status === 'in_progress' && pathname !== '/app/onboarding') {
    return <Navigate to="/app/onboarding" replace />;
  }
  return null;
}
