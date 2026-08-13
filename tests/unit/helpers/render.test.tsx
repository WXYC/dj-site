import { describe, expect, it } from "vitest";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { createTestStore, renderWithProviders } from "@/tests/helpers";

describe("renderWithProviders", () => {
  it("seeds the store it builds from preloadedState", () => {
    const { store } = renderWithProviders(<div />, {
      preloadedState: {
        flowsheet: { ...flowsheetSlice.getInitialState(), autoplay: true },
      },
    });

    expect(flowsheetSlice.selectors.getAutoplay(store.getState())).toBe(true);
  });

  it("uses a caller-supplied store as-is", () => {
    const seeded = createTestStore({
      flowsheet: { ...flowsheetSlice.getInitialState(), autoplay: true },
    });

    const { store } = renderWithProviders(<div />, { store: seeded });

    expect(store).toBe(seeded);
    expect(flowsheetSlice.selectors.getAutoplay(store.getState())).toBe(true);
  });

  it("rejects passing both store and preloadedState at compile time — a supplied store's state would silently win, dropping preloadedState", () => {
    const seeded = createTestStore();

    // @ts-expect-error — store and preloadedState are mutually exclusive; see
    // the SeedOptions union in tests/helpers/render.tsx.
    renderWithProviders(<div />, { store: seeded, preloadedState: {} });
  });
});
