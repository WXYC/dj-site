import { describe, it, expect, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { HttpResponse } from "msw";
import type { FlowsheetRangeResponse, FlowsheetV2Entry } from "@wxyc/shared";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";
import { renderWithPublicProviders as render } from "@/tests/helpers";
import ArchiveStreamTable from "@/src/components/experiences/modern/previous-sets/ArchiveStreamTable";
import {
  useArchiveStreamListing,
  type ArchiveStreamListing,
} from "@/src/hooks/archiveStreamHooks";
import {
  toArchiveStreamRowFromStreamEntry,
  type ArchiveStreamRow,
} from "@/lib/features/flowsheet/stream-row";
import {
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  type FlowsheetEntry,
} from "@/lib/features/flowsheet/types";
import { V2_ENTRY_FACTORIES_BY_TYPE } from "@/tests/fixtures/fixtures";
import { createTestArchiveStreamListing } from "@/tests/fixtures/archiveStreamListing";
import {
  queueRangeResponses,
  rangeEntry,
  type RangeWindow,
} from "@/tests/fakes/flowsheetRange";

const ADD_TIME = "2026-01-15T20:01:00.000Z";
const RADIO_HOUR = "2026-01-15T20:00:00.000Z";
const SHOW_ID = 7;
const ENTRY_ID = 42;
const PAGE_SIZE = 50;
const RETRY_DELAY_MS = 120;
const NOW = Date.parse("2026-09-26T16:00:00.000Z");

const json = (page: FlowsheetRangeResponse) => () => HttpResponse.json(page);
const errorResponse = () =>
  HttpResponse.json({ message: "window read failed" }, { status: 500 });

// The album-information control reads the app router; no navigation happens in these specs.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

const ENTRY_TYPES = Object.values(FlowsheetEntryType);
const TYPE_CASES: Array<[FlowsheetEntryType]> = ENTRY_TYPES.map((entryType) => [entryType]);
const LINK_CASES: Array<[FlowsheetEntryType, boolean]> = ENTRY_TYPES.map((entryType) => [
  entryType,
  entryType === "track",
]);

type EntryOverrides = { id?: number; show_id?: number | null };

function buildEntry(entryType: FlowsheetEntryType, overrides: EntryOverrides = {}): FlowsheetV2Entry {
  return entryType === "breakpoint"
    ? V2_ENTRY_FACTORIES_BY_TYPE.breakpoint({
        add_time: ADD_TIME,
        radio_hour: RADIO_HOUR,
        ...overrides,
      })
    : V2_ENTRY_FACTORIES_BY_TYPE[entryType]({ add_time: ADD_TIME, ...overrides });
}

function rowOf(entryType: FlowsheetEntryType, overrides: EntryOverrides = {}): ArchiveStreamRow {
  return toArchiveStreamRowFromStreamEntry(buildEntry(entryType, overrides));
}

function rowsOf(count: number): ArchiveStreamRow[] {
  return Array.from({ length: count }, (_, i) =>
    rowOf("track", { id: i + 1, show_id: SHOW_ID }),
  );
}

function contentOf(entry: FlowsheetEntry): string {
  if (isFlowsheetSongEntry(entry)) return entry.track_title;
  if (isFlowsheetStartShowEntry(entry) || isFlowsheetEndShowEntry(entry)) {
    return entry.dj_name;
  }
  return entry.message;
}

function renderTable(listing: ArchiveStreamListing) {
  render(<ArchiveStreamTable listing={listing} />);
  const table = screen.getByRole("table", { name: "playlist archive" });
  return { table, bodyRows: table.querySelectorAll("tbody > tr") };
}

describe("ArchiveStreamTable rows", () => {
  it.each(TYPE_CASES)("renders a %s row with its content", (entryType) => {
    const row = rowOf(entryType);
    const { bodyRows } = renderTable(createTestArchiveStreamListing({ rows: [row] }));

    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0]).toHaveTextContent(contentOf(row.entry));
  });

  it("renders no row as playing", () => {
    const rows = ENTRY_TYPES.map((entryType, i) => rowOf(entryType, { id: i + 1 }));
    const { bodyRows } = renderTable(createTestArchiveStreamListing({ rows }));

    expect(bodyRows).toHaveLength(ENTRY_TYPES.length);
    bodyRows.forEach((bodyRow) => expect(bodyRow).not.toHaveClass("row-playing"));
  });

  it("sizes the head with a leading Time unit and gives every row its own Time cell", () => {
    const rows = [rowOf("track", { id: 1 }), rowOf("breakpoint", { id: 2 })];
    const { table, bodyRows } = renderTable(createTestArchiveStreamListing({ rows }));

    expect(table.querySelectorAll("thead > tr > th")).toHaveLength(7);
    bodyRows.forEach((bodyRow, i) => {
      const timeCells = bodyRow.querySelectorAll(".col-time");
      expect(timeCells).toHaveLength(1);
      expect(timeCells[0]).toHaveTextContent(rows[i].timeLabel);
    });
  });

  it("labels its columns, with the narrow layout's stacked labels under Song and Release", () => {
    const { table } = renderTable(createTestArchiveStreamListing({ rows: [rowOf("track")] }));

    const heads = Array.from(table.querySelectorAll("thead > tr > th"));
    expect(heads.map((th) => th.firstChild?.textContent ?? "")).toEqual([
      "Time",
      "",
      "Artist",
      "Song",
      "Release",
      "Label",
      "",
    ]);
    expect(
      Array.from(table.querySelectorAll("thead .field-second-line"), (line) => line.textContent),
    ).toEqual(["Artist", "Label"]);
  });
});

describe("ArchiveStreamTable row links", () => {
  it.each(LINK_CASES)("links a %s row to its show only when it is a playcut", (entryType, linked) => {
    const row = rowOf(entryType, { id: ENTRY_ID, show_id: SHOW_ID });
    const { bodyRows } = renderTable(createTestArchiveStreamListing({ rows: [row] }));

    const links = bodyRows[0].querySelectorAll("a");
    if (linked) {
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", `?show=${SHOW_ID}&entry=${ENTRY_ID}#entry-${ENTRY_ID}`);
    } else {
      expect(links).toHaveLength(0);
    }
  });

  it("leaves a playcut with no show unlinked", () => {
    const row = rowOf("track", { id: ENTRY_ID, show_id: null });
    const { bodyRows } = renderTable(createTestArchiveStreamListing({ rows: [row] }));

    expect(bodyRows[0].querySelectorAll("a")).toHaveLength(0);
  });
});

describe("ArchiveStreamTable album information", () => {
  it("renders one album-information control per song row", () => {
    const { table } = renderTable(createTestArchiveStreamListing({ rows: rowsOf(2) }));

    expect(within(table).queryAllByRole("button", { name: "Album information" })).toHaveLength(2);
  });
});

type StatusCase = {
  name: string;
  listing: Partial<ArchiveStreamListing>;
  rowCount: number;
  spinners: number;
  notice: boolean;
  retrying: boolean;
  end: boolean;
};

describe("ArchiveStreamTable status states", () => {
  it.each<StatusCase>([
    {
      name: "a head load with no rows yet",
      listing: { isHeadLoading: true, hasAnswered: false },
      rowCount: 0,
      spinners: 1,
      notice: false,
      retrying: false,
      end: false,
    },
    {
      name: "a head load over rows already in hand (a seed)",
      listing: { isHeadLoading: true, hasMore: true },
      rowCount: 3,
      spinners: 0,
      notice: false,
      retrying: false,
      end: false,
    },
    {
      name: "a next-page load",
      listing: { isNextPageLoading: true, hasMore: true },
      rowCount: PAGE_SIZE,
      spinners: 1,
      notice: false,
      retrying: false,
      end: false,
    },
    {
      name: "a head retry in flight",
      listing: {
        isHeadLoading: true,
        headFailed: true,
        failedPage: "first",
        isRetrying: true,
      },
      rowCount: 0,
      spinners: 0,
      notice: true,
      retrying: true,
      end: false,
    },
    {
      name: "a next-page retry in flight",
      listing: {
        isNextPageLoading: true,
        nextPageFailed: true,
        failedPage: "later",
        hasMore: true,
        isRetrying: true,
      },
      rowCount: PAGE_SIZE,
      spinners: 0,
      notice: true,
      retrying: true,
      end: false,
    },
    {
      name: "a head failure",
      listing: { headFailed: true, failedPage: "first" },
      rowCount: 0,
      spinners: 0,
      notice: true,
      retrying: false,
      end: false,
    },
    {
      name: "a next-page failure",
      listing: { nextPageFailed: true, failedPage: "later", hasMore: true },
      rowCount: PAGE_SIZE,
      spinners: 0,
      notice: true,
      retrying: false,
      end: false,
    },
    {
      name: "the end of the archive",
      listing: { hasMore: false, hasAnswered: true },
      rowCount: PAGE_SIZE,
      spinners: 0,
      notice: false,
      retrying: false,
      end: true,
    },
    {
      name: "an answer that has not landed yet",
      listing: { hasMore: false, hasAnswered: false },
      rowCount: 0,
      spinners: 0,
      notice: false,
      retrying: false,
      end: false,
    },
    {
      name: "an empty page that still carries a cursor",
      listing: { hasMore: true, hasAnswered: true },
      rowCount: 0,
      spinners: 0,
      notice: false,
      retrying: false,
      end: false,
    },
  ])(
    "shows the right states for $name, with one table row per listing row",
    ({ listing, rowCount, spinners, notice, retrying, end }) => {
      const { table, bodyRows } = renderTable(
        createTestArchiveStreamListing({ ...listing, rows: rowsOf(rowCount) }),
      );

      expect(bodyRows).toHaveLength(rowCount);
      expect(screen.queryAllByRole("progressbar")).toHaveLength(spinners);
      expect(screen.queryByRole("alert") !== null).toBe(notice);
      expect(screen.queryByRole("button", { name: "Retrying…" }) !== null).toBe(retrying);
      expect(screen.queryByText("Beginning of the archive") !== null).toBe(end);
      expect(within(table).queryByRole("progressbar")).toBeNull();
      expect(within(table).queryByRole("alert")).toBeNull();
      expect(within(table).queryByText("Beginning of the archive")).toBeNull();
    },
  );
});

describe("ArchiveStreamTable wired to the listing hook", () => {
  function ArchiveListingHarness() {
    const listing = useArchiveStreamListing();
    return (
      <>
        <ArchiveStreamTable listing={listing} />
        <button type="button" onClick={listing.loadNextPage}>
          Load more
        </button>
      </>
    );
  }

  const firstPage = () =>
    json({
      shows: [],
      entries: Array.from({ length: PAGE_SIZE }, (_, i) => rangeEntry(i + 1, i)),
    });
  const laterPage = () =>
    json({
      shows: [],
      entries: Array.from({ length: PAGE_SIZE }, (_, i) => rangeEntry(1000 + i, i)),
    });

  const bodyRowCount = () =>
    screen.getByRole("table", { name: "playlist archive" }).querySelectorAll("tbody > tr").length;

  // Each case fails one request and retries it. `failedWindow` and
  // `retryWindow` index `windows`: the retry must repeat the failed request's
  // own window, not the head's.
  it.each([
    {
      name: "a head failure",
      responses: [errorResponse, firstPage()],
      arrange: async () => {
        await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      },
      failedWindow: 0,
      retryWindow: 1,
    },
    {
      name: "a next-page failure",
      responses: [firstPage(), errorResponse, laterPage()],
      arrange: async (user: UserEvent) => {
        await waitFor(() => expect(bodyRowCount()).toBe(PAGE_SIZE));
        await user.click(screen.getByRole("button", { name: "Load more" }));
        await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      },
      failedWindow: 1,
      retryWindow: 2,
    },
  ])(
    "keeps the notice mounted and focused, reading Retrying…, through a retry of $name, then clears it on success",
    async ({ responses, arrange, failedWindow, retryWindow }) => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const windows: RangeWindow[] = queueRangeResponses(responses, { delayMs: RETRY_DELAY_MS });
      const { user } = render(<ArchiveListingHarness />);
      await arrange(user);

      const announcement = screen.getByRole("alert");
      const windowsBefore = windows.length;
      await user.click(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Retrying…" })).toHaveFocus(),
      );
      expect(screen.getByRole("alert")).toBe(announcement);

      await waitFor(() => expect(windows).toHaveLength(windowsBefore + 1));
      expect(windows[retryWindow]).toMatchObject({
        start: windows[failedWindow].start,
        end: windows[failedWindow].end,
      });
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    },
  );

  it.each([
    {
      name: "a head failure",
      responses: [errorResponse, errorResponse],
      arrange: async () => {
        await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      },
    },
    {
      name: "a next-page failure",
      responses: [firstPage(), errorResponse, errorResponse],
      arrange: async (user: UserEvent) => {
        await waitFor(() => expect(bodyRowCount()).toBe(PAGE_SIZE));
        await user.click(screen.getByRole("button", { name: "Load more" }));
        await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      },
    },
  ])(
    "gives the control back and re-announces when a retry of $name fails again",
    async ({ responses, arrange }) => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      const windows: RangeWindow[] = queueRangeResponses(responses, { delayMs: RETRY_DELAY_MS });
      const { user } = render(<ArchiveListingHarness />);
      await arrange(user);

      const announcement = screen.getByRole("alert");
      const windowsBefore = windows.length;
      await user.click(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => expect(windows).toHaveLength(windowsBefore + 1));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus(),
      );
      expect(screen.getByRole("alert")).not.toBe(announcement);
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(windows).toHaveLength(windowsBefore + 1);
    },
  );
});
