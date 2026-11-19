/* apps/web/src/api/logbook.ts — shift logbook client */
import { apiClient } from './client';

export type LogbookEntry = {
  id: string;
  propertyId: string;
  authorName: string;
  category: string;
  message: string;
  shift: string | null;
  createdAt: string;
};

export const logbookApi = {
  list: (propertyId?: string) =>
    apiClient
      .get<{ data: LogbookEntry[] }>('/logbook', { params: { propertyId } })
      .then((r) => r.data.data),
  create: (input: { propertyId: string; category: string; message: string; shift?: string }) =>
    apiClient.post<{ data: LogbookEntry }>('/logbook', input).then((r) => r.data.data),
};
