import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTestFlowsheetEntry,
  renderWithProviders,
  stubIntersectionObserver,
} from "@/tests/helpers";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import Main from "@/src/components/experiences/classic/flowsheet/Layout/Main";

// Isolates the Main <-> EntryTable pagination wiring; the surrounding chrome
// has its own specs.
vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => null,
}));
vi.mock("@/src/components/experiences/classic/flowsheet/EntryForm", () => ({
  default: () => null,
}));
vi.mock("@/src/components/experiences/classic/flowsheet/StartShow", () => ({
  default: () => null,
}));

let currentShowSpecialty: { name: string } | null = null;
vi.mock("@/lib/features/flowsheet/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/features/flowsheet/api")>()),
  useGetCurrentShowQuery: (
    _arg: unknown,
    options: { selectFromResult?: (r: { data: unknown }) => unknown }
  ) => {
    const result = { data: { id: 1, specialty: currentShowSpecialty } };
    return options.selectFromResult ? options.selectFromResult(result) : result;
  },
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
  previous?: FlowsheetEntry[];
}) {
  return {
    entries: {
      current: overrides.current,
      previous: overrides.previous ?? [],
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

const { triggerSentinel } = stubIntersectionObserver();

beforeEach(() => {
  vi.clearAllMocks();
  currentShowSpecialty = null;
  mockUseShowControl.mockReturnValue({ live: true, leave: vi.fn() });
  mockUseFlowsheet.mockReturnValue(
    flowsheetResult({ current: firstPage, hasNextPage: true })
  );
});

describe("Main — Classic flowsheet pagination", () => {
  it("reaches the earliest entry of a >20-entry show once the sentinel-triggered fetch resolves", () => {
    const { rerender, queryByText } = renderWithProviders(<Main />);

    expect(queryByText("The Very First Song")).not.toBeInTheDocument();

    triggerSentinel();

    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);

    mockUseFlowsheet.mockReturnValue(
      flowsheetResult({ current: fullShow, hasNextPage: false })
    );
    rerender(<Main />);

    expect(queryByText("The Very First Song")).toBeInTheDocument();
  });

  // `hasNextPage` describes the whole archive, not this show, and an older page
  // merges into the collapsed previous-show section without growing the
  // rendered height — so the sentinel stays put and would re-arm on every
  // poll-driven render, walking the archive backwards unprompted.
  it("stops fetching once a page older than the current show has merged", () => {
    mockUseFlowsheet.mockReturnValue(
      flowsheetResult({
        current: fullShow,
        hasNextPage: true,
        previous: [
          createTestFlowsheetEntry({
            id: 1900,
            play_order: 1,
            track_title: "Something From Last Night",
          }),
        ],
      })
    );

    renderWithProviders(<Main />);

    triggerSentinel();

    expect(mockFetchNextPage).not.toHaveBeenCalled();
  });

  it("names the open set's program on its start-of-show row", () => {
    currentShowSpecialty = { name: "Orange County Special" };
    mockUseFlowsheet.mockReturnValue(
      flowsheetResult({
        current: [
          createTestFlowsheetEntry({ id: 3000, play_order: 1, track_title: "A Song" }),
          {
            id: 2999,
            show_id: 1,
            play_order: 0,
            entry_type: "show_start",
            dj_name: "DJ Cool",
            isStart: true,
            day: "11/14/2023",
            time: "5:13:00 PM",
          } as FlowsheetEntry,
        ],
        hasNextPage: false,
      })
    );

    const { getByText } = renderWithProviders(<Main />);

    expect(getByText(/Start of show — DJ Cool \(Orange County Special\)/)).toBeInTheDocument();
  });
});
