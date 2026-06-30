import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { useCatalogRotationMarking } from "./useCatalogRotationMarking";

vi.mock("@/lib/features/rotation/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/features/rotation/api")>(
    "@/lib/features/rotation/api",
  );
  return {
    ...actual,
    useGetRotationQuery: () => ({
      data: [{ id: 42, rotation_bin: "L", rotation_id: 10 }],
      isFetching: false,
    }),
    useAddRotationEntryMutation: () => [
      vi.fn(() => ({ unwrap: async () => ({ id: 55 }) })),
      { isLoading: false },
    ],
    useKillRotationEntryMutation: () => [
      vi.fn(() => ({ unwrap: async () => ({}) })),
      { isLoading: false },
    ],
  };
});

describe("useCatalogRotationMarking redux sync", () => {
  it("two hook instances share rotationByAlbumId for the same album", async () => {
    const store = makeStore();
    const wrap = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>
        <CssVarsProvider>{children}</CssVarsProvider>
      </Provider>
    );

    const hookA = renderHook(() => useCatalogRotationMarking(42), { wrapper: wrap });
    const hookB = renderHook(() => useCatalogRotationMarking(42), { wrapper: wrap });

    await act(async () => {
      await hookA.result.current.applyRotation("M");
    });

    expect(
      catalogSlice.selectors.getAlbumRotation(store.getState(), 42)?.rotation_bin,
    ).toBe("M");
    expect(hookB.result.current.selectedBin).toBe("M");
  });
});
