/* apps/web/src/stores/propertyStore.ts — C1
 * Sticky property-switcher choice. Mirrored to localStorage so the axios
 * interceptor (client.ts) can read it synchronously on every request.
 * hasChosen distinguishes "user picked All properties" (explicit) from
 * "never chose" (default to first property — F-5). */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PropertyState {
  currentPropertyId: string | null;
  hasChosen: boolean;
  setCurrentPropertyId: (id: string | null) => void;
  markChosen: () => void;
  clear: () => void;
}

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set) => ({
      currentPropertyId: null,
      hasChosen: false,
      setCurrentPropertyId: (id) => set({ currentPropertyId: id }),
      markChosen: () => set({ hasChosen: true }),
      clear: () => set({ currentPropertyId: null, hasChosen: false }),
    }),
    { name: 'vimad-current-property' }
  )
);

/** Synchronous read for the axios request interceptor. */
export function getCurrentPropertyId(): string | null {
  return usePropertyStore.getState().currentPropertyId;
}
