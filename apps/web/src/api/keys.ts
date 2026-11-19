/* apps/web/src/api/keys.ts — V1-prime key issuance client */
import { apiClient } from './client';

export type KeyIssuance = {
  id: string;
  roomId: string;
  room?: { number: string };
  reservationId?: string | null;
  guestName?: string | null;
  issuerName: string;
  status: 'active' | 'returned' | 'lost';
  issuedAt: string;
  returnedAt?: string | null;
  notes?: string | null;
};

export const keysApi = {
  list: (propertyId?: string) =>
    apiClient
      .get<{ data: KeyIssuance[] }>('/keys', { params: { propertyId } })
      .then((r) => r.data.data),
  issue: (input: { roomId: string; guestName?: string; reservationId?: string; notes?: string }) =>
    apiClient.post<{ data: KeyIssuance }>('/keys/issue', input).then((r) => r.data.data),
  returnKey: (id: string) => apiClient.post(`/keys/${id}/return`, {}).then((r) => r.data),
  markLost: (id: string) => apiClient.post(`/keys/${id}/lost`, {}).then((r) => r.data),
};
