import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/tests/helpers/render";
import FlowsheetLink from "@/src/components/experiences/modern/Leftbar/FlowsheetLink";
import BinContent from "@/src/components/experiences/modern/Rightbar/Bin/BinContent";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";

// Proves the WXYC/dj-site#1056 fix: mounting the catalog route's persistent
// chrome (Leftbar's FlowsheetLink, Rightbar's Mail Bin) alongside the catalog
// Results table must never subscribe to the heavy paginated
// useGetInfiniteEntriesInfiniteQuery. Before the useLiveStatus split, all
// three components called useShowControl for `{ live }` alone and dragged
// that subscription onto every catalog page load. `@/src/hooks/flowsheetHooks`
// is intentionally left UNMOCKED here so the real useLiveStatus/useQueue/
// useFlowsheetActions implementations run; only their RTK Query and
// authentication dependencies are stubbed for determinism.

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/catalog",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@mui/icons-material", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mui/icons-material")>();
  return {
    ...actual,
    CellTower: () => <span data-testid="celltower-icon" />,
    Inbox: () => <span data-testid="inbox-icon" />,
  };
});

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({
    loading: false,
    info: { id: "test-user-1", real_name: "Test User", dj_name: "Test DJ" },
  }),
}));

vi.mock("@/src/hooks/binHooks", () => ({
  useBin: () => ({ bin: [], isError: false, loading: false }),
  useDeleteFromBin: () => ({ deleteFromBin: vi.fn() }),
}));

vi.mock(
  "@/src/components/experiences/modern/Rightbar/RightBarContentContainer",
  () => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);
vi.mock("@/src/components/experiences/modern/Rightbar/Bin/BinEntry", () => ({
  default: () => null,
}));
vi.mock(
  "@/src/components/experiences/modern/Rightbar/Bin/ClearBinButton",
  () => ({ default: () => null })
);
vi.mock(
  "@/src/components/experiences/modern/Rightbar/Bin/ExportBinButton",
  () => ({ default: () => null })
);

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogQueryResults: () => ({
    results: [],
    total: 0,
    isLoadingInitial: false,
    isFetchingMore: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isError: false,
  }),
  useCatalogQuerySearch: () => ({
    selected: [],
    setSelection: vi.fn(),
    sortBy: "album",
    sortOrder: "asc",
    hasActiveQuery: false,
    setSort: vi.fn(),
  }),
}));

vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock(
  "@/src/components/experiences/modern/catalog/Results/ResultsContainer",
  () => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);
vi.mock("@/src/components/experiences/modern/catalog/Results/Result", () => ({
  default: () => null,
}));
vi.mock(
  "@/src/components/experiences/modern/catalog/Results/MobileResult",
  () => ({ default: () => null })
);

// Applies options.selectFromResult over a base result, mirroring RTK Query's
// own behavior, so the real useLiveStatus/useShowControl/useQueue
// implementations (kept unmocked below) narrow exactly as they do in
// production instead of receiving the whole unshaped mock object.
type QueryHookOptions = {
  selectFromResult?: (r: unknown) => Record<string, unknown>;
};
function withSelectFromResult(
  result: Record<string, unknown>,
  options?: QueryHookOptions
) {
  return options?.selectFromResult
    ? { ...result, ...options.selectFromResult(result) }
    : result;
}

const mockUseWhoIsLiveQuery = vi.fn(() => ({
  data: { djs: [], onAir: "" },
  isLoading: false,
  isSuccess: true,
  isFetching: false,
}));

const mockUseGetInfiniteEntriesInfiniteQuery = vi.fn(() => ({
  data: undefined,
  isLoading: false,
  isSuccess: false,
  isError: false,
  isFetching: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
}));

// `flowsheetApi` (the RTK Query object with its `.reducer`/`.middleware`) is
// kept REAL via importOriginal — `lib/store.ts` wires it straight into
// `configureStore`, so replacing it outright would break every test's store,
// not just this one. Only the hook exports the components under test call
// are swapped for deterministic spies/stubs.
vi.mock("@/lib/features/flowsheet/api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/features/flowsheet/api")>();
  return {
    ...actual,
    useWhoIsLiveQuery: (_arg: unknown, options?: QueryHookOptions) =>
      withSelectFromResult(mockUseWhoIsLiveQuery(), options),
    useGetInfiniteEntriesInfiniteQuery: (
      _arg: unknown,
      options?: QueryHookOptions
    ) => withSelectFromResult(mockUseGetInfiniteEntriesInfiniteQuery(), options),
    useJoinShowMutation: () => [vi.fn(), { isLoading: false }],
    useLeaveShowMutation: () => [vi.fn(), { isLoading: false }],
    useAddToFlowsheetMutation: () => [
      vi.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) })),
      { isLoading: false },
    ],
    useRemoveFromFlowsheetMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateFlowsheetMutation: () => [vi.fn(), { isLoading: false }],
    useSwitchEntriesMutation: () => [vi.fn(), { isLoading: false }],
  };
});

describe("catalog route subscription profile (#1056)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWhoIsLiveQuery.mockReturnValue({
      data: { djs: [], onAir: "" },
      isLoading: false,
      isSuccess: true,
      isFetching: false,
    });
  });

  it("never subscribes to the heavy paginated entries query when the chrome and Results are mounted together", () => {
    renderWithProviders(
      <>
        <FlowsheetLink />
        <BinContent />
        <Results color={undefined} />
      </>
    );

    expect(mockUseGetInfiniteEntriesInfiniteQuery).not.toHaveBeenCalled();
    // Sanity check: the lightweight WhoIsLive poll IS still exercised (by
    // useLiveStatus inside FlowsheetLink/BinContent/Results, and again inside
    // useQueue) — proving the assertion above isn't vacuously true because
    // nothing in the tree subscribed to flowsheetApi at all.
    expect(mockUseWhoIsLiveQuery).toHaveBeenCalled();
  });
});
