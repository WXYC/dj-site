import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { createTestFlowsheetEntry, renderWithProviders } from "@/tests/helpers";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import Main from "@/src/components/experiences/classic/flowsheet/Layout/Main";

// This spec is about the Layout/Main <-> EntryTable pagination wiring dj-site
// #1542 diagnosed as missing, not the surrounding chrome those already have
// their own specs for.
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => null,
}));
vi.mock("@/src/components/experiences/classic/flowsheet/EntryForm", () => ({
  default: () => null,
}));
vi.mock("@/src/components/experiences/classic/flowsheet/StartShow", () => ({
  default: () => null,
}));

const mockFetchNextPage = vi.fn();
const mockUseFlowsheet = vi.fn();
const mockUseShowControl = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheet: () => mockUseFlowsheet(),
  useShowControl: () => mockUseShowControl(),
}));

// A single live show whose entry count crossed the FLOWSHEET_PAGE_SIZE
// cliff: 20 already-loaded entries (newest-first, matching the sort
// useFlowsheet hands Main) plus one further-back entry only a second page
// can supply.
const firstPage: FlowsheetEntry[] = Array.from({ length: 20 }, (_, i) =>
  createTestFlowsheetEntry({
    id: 2000 - i,
    play_order: 21 - i,
    track_title: `Song ${21 - i}`,
  })
);
const earliestEntry = createTestFlowsheetEntry({
  id: 1975,
  play_order: 1,
  track_title: "The Very First Song",
});
const fullShow: FlowsheetEntry[] = [...firstPage, earliestEntry];

function flowsheetResult(overrides: {
  current: FlowsheetEntry[];
  hasNextPage: boolean;
}) {
  return {
    entries: {
      current: overrides.current,
      previous: [],
      switchEntries: vi.fn(),
    },
    addToFlowsheet: vi.fn(),
    removeFromFlowsheet: vi.fn(),
    updateFlowsheet: vi.fn(),
    removeFromQueue: vi.fn(),
    loading: false,
    isFetching: false,
    hasNextPage: overrides.hasNextPage,
    fetchNextPage: mockFetchNextPage,
    isFetchingNextPage: false,
    isSuccess: true,
    isError: false,
  };
}

let observedCallback: IntersectionObserverCallback | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  observedCallback = undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observedCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
  mockUseShowControl.mockReturnValue({ live: true, leave: vi.fn() });
  mockUseFlowsheet.mockReturnValue(
    flowsheetResult({ current: firstPage, hasNextPage: true })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Main — Classic flowsheet pagination", () => {
  it("reaches the earliest entry of a >20-entry show once the sentinel-triggered fetch resolves", () => {
    const { rerender, queryByText } = renderWithProviders(<Main />);

    expect(queryByText("The Very First Song")).not.toBeInTheDocument();

    act(() => {
      observedCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        null as unknown as IntersectionObserver
      );
    });

    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);

    // The RTK Query cache growing after fetchNextPage resolves: useFlowsheet
    // re-derives a wider `entries.current` with no further page to fetch.
    mockUseFlowsheet.mockReturnValue(
      flowsheetResult({ current: fullShow, hasNextPage: false })
    );
    rerender(<Main />);

    expect(queryByText("The Very First Song")).toBeInTheDocument();
  });
});
