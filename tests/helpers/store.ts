import type { AppStore, RootState } from "@/lib/store";
import { makeStore } from "@/lib/store";

/**
 * Create a store for use in tests.
 * Returns a fresh store instance for each test.
 */
export function createTestStore(preloadedState?: Partial<RootState>): AppStore {
  return makeStore(preloadedState);
}
