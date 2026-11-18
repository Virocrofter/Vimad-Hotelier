/* apps/web/src/api/concierge.ts — T3 concierge board client */
import { apiGet, apiPost, apiPatch } from './client';
import { formatMoney } from '../lib/money';

// House client (api/client.ts) already attaches the JWT, refreshes expired
// tokens, sends x-property-id, and normalizes /v1. The local getToken() probe
// of 5 localStorage keys is gone (#72/#78) — one auth path for the whole app.

const unwrap = <T>(p: Promise<T>): Promise<T> => p.then((b: any) => b.data as T);

export const conciergeApi = {
  board: (date: string, propertyId?: string) =>
    unwrap(
      apiGet<{ date: string; overdue: any[]; counts: any; sections: Record<string, any[]> }>(
        '/v1/concierge/board',
        { params: { date, propertyId } }
      )
    ),

  create: (input: Record<string, unknown>) =>
    unwrap(apiPost<{ id: string }>('/v1/concierge', input)),

  update: (id: string, patch: Record<string, unknown>) =>
    unwrap(apiPatch<{ updated: boolean }>(`/v1/concierge/${id}`, patch)),

  postToFolio: (id: string) =>
    unwrap(
      apiPost<{ folioItemId: string; alreadyPosted: boolean }>(`/v1/concierge/${id}/post-to-folio`)
    ),
};

export const CONCIERGE_TYPES = [
  { value: 'transfer', label: 'Transfer' },
  { value: 'special_request', label: 'Special request' },
  { value: 'wake_up_call', label: 'Wake-up call' },
  { value: 'restaurant_booking', label: 'Restaurant booking' },
  { value: 'activity_booking', label: 'Activity booking' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'gesture', label: 'Guest gesture' },
] as const;

export const TRIP_FLOW = ['requested', 'confirmed', 'assigned', 'en_route', 'completed'] as const;

export const fmtRand = (minor: number) => formatMoney(minor / 100);
