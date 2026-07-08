import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/lib/test-utils";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useFlowsheetSmartEntry } from "./useFlowsheetSmartEntry";

// The hook composes useFlowsheetSubmit purely to reach handleSubmit + the
// queue-modifier state. That collaborator drags in the whole search/auth/RTK
// stack and is exercised end-to-end elsewhere (addToFlowsheet.wiring.test,
// e2e). Here we mock it to a spy so we can unit-test THIS hook's own logic:
// parse -> debounced setParsedFields, the Escape ladder, selected-match
// auto-deselect, and that submit flushes + merges before handing off.
const handleSubmitMock = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/hooks/flowsheetHooks")>();
  return {
    ...actual,
    useFlowsheetSubmit: () => ({
      handleSubmit: handleSubmitMock,
      ctrlKeyPressed: false,
    }),
  };
});

let api: ReturnType<typeof useFlowsheetSmartEntry>;

function Host() {
  api = useFlowsheetSmartEntry();
  return (
    <form onSubmit={(e) => api.submit(e)}>
      <textarea
        data-testid="composer"
        value={api.raw}
        onChange={(e) => api.onRawChange(e.target.value)}
      />
      <button type="submit">go</button>
    </form>
  );
}

const renderHost = () => renderWithProviders(<Host />);

const query = (store: ReturnType<typeof renderHost>["store"]) =>
  flowsheetSlice.selectors.getSearchQuery(store.getState());

const type = (value: string) =>
  act(() => {
    fireEvent.change(screen.getByTestId("composer"), { target: { value } });
  });

describe("useFlowsheetSmartEntry", () => {
  beforeEach(() => {
    handleSubmitMock.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  describe("parsed-field syncing", () => {
    it("writes parsed trigger fields into the store after the debounce", () => {
      const { store } = renderHost();
      type("Percolator by Stereolab on Dots and Loops");
      act(() => vi.advanceTimersByTime(250));

      const q = query(store);
      expect(q.song).toBe("Percolator");
      expect(q.artist).toBe("Stereolab");
      expect(q.album).toBe("Dots and Loops");
    });

    it("parses semicolon default order", () => {
      const { store } = renderHost();
      type("Track 1; Jessica Pratt; On Your Own Love Again");
      act(() => vi.advanceTimersByTime(250));

      const q = query(store);
      expect(q.song).toBe("Track 1");
      expect(q.artist).toBe("Jessica Pratt");
      expect(q.album).toBe("On Your Own Love Again");
    });

    it("opens the search panel once text is entered", () => {
      const { store } = renderHost();
      type("Percolator");
      expect(flowsheetSlice.selectors.getSearchOpen(store.getState())).toBe(
        true
      );
    });
  });

  describe("Escape ladder", () => {
    it("suppresses the newest trigger, freeing it back into the song", () => {
      const { store } = renderHost();
      type("Standing on the Corner");
      act(() => vi.advanceTimersByTime(250));
      expect(query(store).album).toBe("the Corner"); // "on" parsed as album

      act(() => {
        api.handleEscape();
      });
      act(() => vi.advanceTimersByTime(250));

      const q = query(store);
      expect(q.song).toBe("Standing on the Corner");
      expect(q.album).toBe("");
    });

    it("returns false at the base state (nothing to back out of)", () => {
      renderHost();
      let consumed = true;
      act(() => {
        consumed = api.handleEscape();
      });
      expect(consumed).toBe(false);
    });
  });

  describe("selected-match auto-deselect", () => {
    const seedMatch = (store: ReturnType<typeof renderHost>["store"]) =>
      act(() => {
        store.dispatch(
          flowsheetSlice.actions.setSelectedMatch({
            id: 1,
            artist: "Stereolab",
            album: "Dots and Loops",
            label: "Duophonic",
          })
        );
      });

    it("clears the match once the typed artist diverges from it", () => {
      const { store } = renderHost();
      seedMatch(store);
      type("Song by Stereolen");
      act(() => vi.advanceTimersByTime(250));
      expect(
        flowsheetSlice.selectors.getSelectedMatch(store.getState())
      ).toBeNull();
    });

    it("keeps the match while the typed artist is still a prefix", () => {
      const { store } = renderHost();
      seedMatch(store);
      type("Song by Stereo");
      act(() => vi.advanceTimersByTime(250));
      expect(
        flowsheetSlice.selectors.getSelectedMatch(store.getState())
      ).not.toBeNull();
    });
  });

  describe("ghost text", () => {
    it("acceptGhost appends the suffix, locks the field, and narrows results", () => {
      const { store } = renderHost();
      type("Percolator by Ju");
      act(() => vi.advanceTimersByTime(250));

      act(() => {
        api.acceptGhost("ana Molina", "artist", "Juana Molina");
      });

      expect(api.raw).toBe("Percolator by Juana Molina");
      expect(api.locks.artist).toBe("Juana Molina");
      act(() => vi.advanceTimersByTime(250));
      expect(query(store).artist).toBe("Juana Molina");
    });

    it("dismissGhost records the dismissed field and prefix", () => {
      renderHost();
      type("Percolator by Ju");
      act(() => {
        api.dismissGhost("artist", "Ju");
      });
      expect(api.dismissedGhost).toEqual({ field: "artist", prefix: "Ju" });
    });

    it("editing after a dismiss reopens ghost consideration", () => {
      renderHost();
      type("Percolator by Ju");
      act(() => {
        api.dismissGhost("artist", "Ju");
      });
      type("Percolator by Jua"); // any edit clears the memo
      expect(api.dismissedGhost).toBeNull();
    });
  });

  describe("result fill + autofill undo", () => {
    const match = createTestAlbum({
      id: 4201,
      title: "Dots and Loops",
      label: "Duophonic",
      artist: createTestArtist({ name: "Stereolab" }),
    });

    it("selectMatch fills the sentence, keeping the user's song", () => {
      renderHost();
      type("Percolator by Ste");
      act(() => vi.advanceTimersByTime(250));

      act(() => {
        api.selectMatch(match);
      });

      expect(api.raw).toBe(
        "Percolator by Stereolab on Dots and Loops via Duophonic"
      );
      expect(api.locks.artist).toBe("Stereolab");
      expect(api.locks.album).toBe("Dots and Loops");
    });

    it("one Backspace undoes a result fill and clears the selected match", () => {
      const { store } = renderHost();
      type("Percolator by Ste");
      act(() => vi.advanceTimersByTime(250));
      act(() => {
        api.selectMatch(match);
      });
      expect(
        flowsheetSlice.selectors.getSelectedMatch(store.getState())
      ).not.toBeNull();

      let undone = false;
      act(() => {
        undone = api.undoAutofill();
      });
      expect(undone).toBe(true);
      expect(api.raw).toBe("Percolator by Ste");
      // Undoing the fill removes the selection, same as the ✕.
      expect(
        flowsheetSlice.selectors.getSelectedMatch(store.getState())
      ).toBeNull();
    });

    it("removeMatch (the x) reverts a fresh fill and clears the match", () => {
      const { store } = renderHost();
      type("Percolator by Ste");
      act(() => vi.advanceTimersByTime(250));
      act(() => {
        api.selectMatch(match);
      });
      expect(api.raw).toContain("Stereolab");

      act(() => {
        api.removeMatch();
      });
      expect(api.raw).toBe("Percolator by Ste");
      expect(
        flowsheetSlice.selectors.getSelectedMatch(store.getState())
      ).toBeNull();
    });

    it("removeMatch just clears the match once the sentence was edited", () => {
      const { store } = renderHost();
      type("Percolator by Ste");
      act(() => vi.advanceTimersByTime(250));
      act(() => {
        api.selectMatch(match);
      });
      // Edit the label after the fill (artist/album still match, so the match
      // stays selected) — this spends the one-shot undo.
      const edited = `${api.raw} Reissue`;
      type(edited);
      act(() => vi.advanceTimersByTime(250));
      expect(
        flowsheetSlice.selectors.getSelectedMatch(store.getState())
      ).not.toBeNull();

      act(() => {
        api.removeMatch();
      });
      // The sentence stands (the DJ's edits), only the match is cleared.
      expect(api.raw).toBe(edited);
      expect(
        flowsheetSlice.selectors.getSelectedMatch(store.getState())
      ).toBeNull();
    });

    it("one Backspace undoes a ghost accept", () => {
      renderHost();
      type("by Ju");
      act(() => {
        api.acceptGhost("ana Molina", "artist", "Juana Molina");
      });
      expect(api.raw).toBe("by Juana Molina");

      act(() => {
        expect(api.undoAutofill()).toBe(true);
      });
      expect(api.raw).toBe("by Ju");
    });

    it("undoAutofill is a no-op when there was no autofill", () => {
      renderHost();
      type("Percolator");
      act(() => {
        expect(api.undoAutofill()).toBe(false);
      });
    });

    it("pickTrack sets the song to the track title and records track_position", () => {
      const { store } = renderHost();
      act(() => {
        store.dispatch(
          flowsheetSlice.actions.setSelectedMatch({
            id: 4201,
            album_id: 4201,
            artist: "Stereolab",
            album: "Dots and Loops",
            label: "Duophonic",
          })
        );
      });

      act(() => {
        api.pickTrack("Percolator", "A1");
      });

      expect(api.raw).toBe(
        "Percolator by Stereolab on Dots and Loops via Duophonic"
      );
      expect(query(store).track_position).toBe("A1");
    });

    it("a normal edit commits the autofill so undo no longer applies", () => {
      renderHost();
      type("by Ju");
      act(() => {
        api.acceptGhost("ana Molina", "artist", "Juana Molina");
      });
      type("by Juana Molina!"); // ordinary edit
      act(() => {
        expect(api.undoAutofill()).toBe(false);
      });
    });
  });

  describe("submit", () => {
    it("flushes and hands the merged pending query to handleSubmit", () => {
      renderHost();
      type("Percolator by Stereolab");
      // No debounce wait — submit must flush the current parse itself.
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "go" }));
      });

      expect(handleSubmitMock).toHaveBeenCalledTimes(1);
      const merged = handleSubmitMock.mock.calls[0][1];
      expect(merged).toMatchObject({ song: "Percolator", artist: "Stereolab" });
    });

    it("injects the selected match's linkage into the submitted query", () => {
      const { store } = renderHost();
      act(() => {
        store.dispatch(
          flowsheetSlice.actions.setSelectedMatch({
            id: 4201,
            album_id: 4201,
            rotation_id: 12,
            rotation_bin: "H",
            artist: "Stereolab",
            album: "Dots and Loops",
            label: "Duophonic",
          })
        );
      });
      type("Percolator by Stereo");
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "go" }));
      });

      const merged = handleSubmitMock.mock.calls[0][1];
      expect(merged).toMatchObject({
        song: "Percolator",
        artist: "Stereolab", // snapped to the match's canonical value
        album: "Dots and Loops",
        album_id: 4201,
        rotation_id: 12,
      });
    });

    it("resets the composer after a submit with a song", () => {
      renderHost();
      type("Percolator by Stereolab");
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "go" }));
      });
      expect(api.raw).toBe("");
    });

    it("does not reset when the song is empty", () => {
      renderHost();
      type("by Stereolab"); // artist only, no song
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "go" }));
      });
      expect(api.raw).toBe("by Stereolab");
    });
  });
});
