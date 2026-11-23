/* apps/web/src/hooks/useSupervisor.ts — 7.x supervisor surfaces
 * Space-report, bulk-assign, L&F ledger over the supervisor API.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSpaceReport,
  bulkAssignTasks,
  fetchLostFound,
  createLostFound,
  updateLostFound,
} from '../api/minibar';

const KEY = 'supervisor';

export function useSpaceReport(propertyId?: string) {
  return useQuery({
    queryKey: [KEY, 'space-report', propertyId],
    queryFn: () => fetchSpaceReport(propertyId as string),
    enabled: !!propertyId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 30,
  });
}

export function useBulkAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskIds, assigneeId }: { taskIds: string[]; assigneeId: string }) =>
      bulkAssignTasks(taskIds, assigneeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['housekeeping'] });
    },
  });
}

export function useLostFound(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: [KEY, 'lost-found', params],
    queryFn: () => fetchLostFound(params),
    staleTime: 1000 * 15,
  });
}

export function useLostFoundMutations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: string } & Record<string, unknown>) =>
      id ? updateLostFound(id, payload) : createLostFound(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'lost-found'] }),
  });
}
