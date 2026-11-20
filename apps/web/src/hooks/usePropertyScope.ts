/* apps/web/src/hooks/usePropertyScope.ts — C1
 * Single source of truth for the property switcher. Resolves the effective
 * property (store choice → server-sticky choice → null = whole chain/tenant),
 * persists changes server-side, and invalidates the query cache on switch.
 */
import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getScope,
  setCurrentProperty,
  type PropertyScope,
  type ScopeProperty,
} from '../api/chains';
import { listProperties } from '../api/properties';
import { usePropertyStore } from '../stores/propertyStore';

export interface PropertyScopeResult {
  properties: ScopeProperty[];
  chains: PropertyScope['chains'];
  /** Effective selection — null means "all properties" (no filter). */
  current: ScopeProperty | null;
  /** Server-sticky default for first paint. */
  serverCurrentPropertyId: string | null;
  isLoading: boolean;
  error: Error | null;
  selectProperty: (propertyId: string | null) => Promise<void>;
}

export function usePropertyScope(): PropertyScopeResult {
  const queryClient = useQueryClient();
  const storedId = usePropertyStore((s) => s.currentPropertyId);
  const hasChosen = usePropertyStore((s) => s.hasChosen);

  const { data, isLoading, error } = useQuery({
    queryKey: ['property-scope'],
    queryFn: getScope,
    staleTime: 30_000,
  });

  // getScope is chain-centric and returns an empty property list for
  // non-chain tenants — fall back to the plain properties list (F-5).
  const { data: propertyList } = useQuery({
    queryKey: ['properties'],
    queryFn: listProperties,
    staleTime: 60_000,
  });
  // Cast: Property lacks ScopeProperty._count (reservation counts, optional
  // display only) — id/name exist on both shapes.
  const properties = (
    data?.properties?.length ? data.properties : (propertyList ?? [])
  ) as ScopeProperty[];
  const preferred = storedId ?? data?.currentPropertyId ?? null;
  const current = properties.find((p) => p.id === preferred) ?? null;

  // F-5: a never-chosen session defaults to the first property so every
  // request carries x-property-id (SH-05: zero cross-property leaks by
  // default). An explicit "All properties" pick (hasChosen) is respected.
  useEffect(() => {
    if (hasChosen || storedId || data?.currentPropertyId || properties.length === 0 || isLoading) {
      return;
    }
    void selectProperty(properties[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChosen, storedId, data?.currentPropertyId, properties.length, isLoading]);

  const selectProperty = useCallback(
    async (propertyId: string | null) => {
      usePropertyStore.getState().markChosen();
      usePropertyStore.getState().setCurrentPropertyId(propertyId);
      if (propertyId) {
        try {
          await setCurrentProperty(propertyId);
        } catch {
          // Sticky persistence is best-effort — the local choice still applies.
        }
      } else {
        try {
          await setCurrentProperty(null);
        } catch {
          // ignore
        }
      }
      await queryClient.invalidateQueries();
    },
    [queryClient]
  );

  return {
    properties,
    chains: data?.chains ?? [],
    current,
    serverCurrentPropertyId: data?.currentPropertyId ?? null,
    isLoading,
    error: error as Error | null,
    selectProperty,
  };
}
