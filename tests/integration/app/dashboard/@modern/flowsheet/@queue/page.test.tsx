import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import {
  createTestFlowsheetQuery,
  createTestStore,
  renderWithProviders,
} from "@/tests/helpers";
import { useFlowsheetDragContext } from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";
import Queue from "@/app/dashboard/@modern/flowsheet/@queue/page";

// The queue rows themselves aren't under test — replace them with stubs that
// expose the page's drag context so tests can end a drag on a given entry.
vi.mock(
  "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntry",
  () => ({
    default: ({ entry }: { entry: FlowsheetSongEntry }) => {
      const { onEntryDragEnd } = useFlowsheetDragContext();
      return (
        <tr data-testid={`queue-row-${entry.id}`}>
          <td>
            <button
              data-testid={`end-drag-${entry.id}`}
              onClick={() => onEntryDragEnd(entry)}
            >
              {entry.track_title}
            </button>
          </td>
        </tr>
      );
    },
  })
);

// Capture Reorder.Group's props so tests can feed it mid-drag orders.
const reorderGroupProps: any[] = [];
vi.mock("motion/react", () => ({
  Reorder: {
    Group: ({ children, values, onReorder }: any) => {
      reorderGroupProps.push({ values, onReorder });
      return <tbody>{children}</tbody>;
    },
  },
}));

function queueSongs(store: ReturnType<typeof createTestStore>) {
  return store.getState().flowsheet.queue;
}

describe("Queue drag reorder", () => {
  beforeEach(() => {
    reorderGroupProps.length = 0;
    window.localStorage.clear();
  });

  function setup() {
    const store = createTestStore();
    // Queue ids are assigned 0, 1, 2 in insertion order.
    act(() => {
      store.dispatch(
        flowsheetSlice.actions.addToQueue(
          createTestFlowsheetQuery({ song: "On Your Own Love Again" })
        )
      );
      store.dispatch(
        flowsheetSlice.actions.addToQueue(
          createTestFlowsheetQuery({ song: "Back, Baby" })
        )
      );
      store.dispatch(
        flowsheetSlice.actions.addToQueue(
          createTestFlowsheetQuery({ song: "Strange Melody" })
        )
      );
    });
    const view = renderWithProviders(<Queue />, { store });
    return { store, view };
  }

  it("renders the queue reversed (next-to-play last)", () => {
    setup();
    const latest = reorderGroupProps[reorderGroupProps.length - 1];
    expect(latest.values.map((e: FlowsheetSongEntry) => e.id)).toEqual([
      2, 1, 0,
    ]);
  });

  it("commits the un-reversed order to the queue on drag end", () => {
    const { store } = setup();
    const latest = reorderGroupProps[reorderGroupProps.length - 1];
    const [c, b, a] = latest.values as FlowsheetSongEntry[];

    // Drag C (displayed first) below B: visual order becomes [B, C, A].
    act(() => {
      latest.onReorder([b, c, a]);
    });
    act(() => {
      screen.getByTestId(`end-drag-${c.id}`).click();
    });

    // Stored queue is the visual order un-reversed: [A, C, B].
    expect(queueSongs(store).map((e) => e.id)).toEqual([a.id, c.id, b.id]);
  });

  it("keeps the queue unchanged when a drag ends without movement", () => {
    const { store } = setup();
    const before = queueSongs(store).map((e) => e.id);
    const latest = reorderGroupProps[reorderGroupProps.length - 1];
    const first = latest.values[0] as FlowsheetSongEntry;

    act(() => {
      screen.getByTestId(`end-drag-${first.id}`).click();
    });

    expect(queueSongs(store).map((e) => e.id)).toEqual(before);
  });
});
