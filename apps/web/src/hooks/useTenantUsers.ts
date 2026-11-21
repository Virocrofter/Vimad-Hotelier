/* EX-05 — tenant users for the exceptions assignee picker. */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface TenantUserOption {
  id: string;
  name: string;
}

export function useTenantUsers() {
  return useQuery<TenantUserOption[]>({
    queryKey: ['tenant-users'],
    queryFn: async () => {
      const res = await apiClient.get('/users', { params: { pageSize: 100 } });
      const raw = res?.data?.data ?? res?.data ?? [];
      const list = Array.isArray(raw) ? raw : (raw.items ?? []);
      return list.map((u: any) => ({
        id: u.id,
        name:
          u.name ??
          u.fullName ??
          [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ??
          u.email ??
          u.id,
      }));
    },
    staleTime: 60_000,
  });
}
