import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { TEST_SEARCH_STRINGS } from "@/tests/helpers";
import { useArtistDedupCheck } from "@/src/hooks/catalogHooks";
import type { ArtistInGenreOption } from "@/lib/features/catalog/types";

const STEREOLAB: ArtistInGenreOption = {
  id: 1,
  artist_name: "Stereolab",
  code_letters: TEST_SEARCH_STRINGS.CODE_LETTERS.STEREOLAB,
  code_number: 87,
};

function renderDedup(trimmedName = "Stereolab") {
  return renderHook(({ name }) => useArtistDedupCheck(name), {
    initialProps: { name: trimmedName },
  });
}

describe("useArtistDedupCheck", () => {
  it("starts with nothing held and nothing pending", () => {
    const { result } = renderDedup();

    expect(result.current.existingArtist).toBeNull();
    expect(result.current.dedupCheckStale).toBe(false);
  });

  it("holds the artist the typeahead confirmed", () => {
    const { result } = renderDedup();

    act(() => result.current.onArtistSelected(STEREOLAB));

    expect(result.current.existingArtist).toEqual(STEREOLAB);
  });

  it("clears the held artist when the typeahead reports create-new", () => {
    const { result } = renderDedup();

    act(() => result.current.onArtistSelected(STEREOLAB));
    act(() => result.current.onCreateNewSelected());

    expect(result.current.existingArtist).toBeNull();
    expect(result.current.dedupCheckStale).toBe(false);
  });

  it("marks the check stale on a genre change while a name is typed", () => {
    const { result } = renderDedup();

    act(() => result.current.onGenreChange());

    expect(result.current.dedupCheckStale).toBe(true);
  });

  it("does not mark the check stale on a genre change with no name typed", () => {
    // Nothing has been asked about the empty field, so there is no answer to
    // go stale — and blocking submit here would fire before the MD has typed.
    const { result } = renderDedup("");

    act(() => result.current.onGenreChange());

    expect(result.current.dedupCheckStale).toBe(false);
  });

  it("keeps the check stale when a cleared selection is the only news", () => {
    // Reopening the typeahead's panel re-runs the search but reports nothing
    // back, so a cleared selection is not an answer about the current genre.
    // Reading it as one would re-enable submit at the moment the check matters.
    const { result } = renderDedup();

    act(() => result.current.onArtistSelected(STEREOLAB));
    act(() => result.current.onGenreChange());
    act(() => result.current.onSelectionCleared());

    expect(result.current.existingArtist).toBeNull();
    expect(result.current.dedupCheckStale).toBe(true);
  });

  it("clears the stale flag once the typeahead answers under the new genre", () => {
    const { result } = renderDedup();

    act(() => result.current.onGenreChange());
    act(() => result.current.onArtistSelected(STEREOLAB));

    expect(result.current.dedupCheckStale).toBe(false);
  });

  it("clears the stale flag when the name becomes a different question", () => {
    const { result } = renderDedup();

    act(() => result.current.onGenreChange());
    act(() => result.current.onNameChange("Stereolab Peng"));

    expect(result.current.dedupCheckStale).toBe(false);
  });

  it("keeps the stale flag through a whitespace-only edit", () => {
    // The edit trims back to the exact name the flag was raised against, so it
    // is not a different question and must not dismiss a re-check that the new
    // genre's search has not answered.
    const { result } = renderDedup();

    act(() => result.current.onGenreChange());
    act(() => result.current.onNameChange("  Stereolab  "));

    expect(result.current.dedupCheckStale).toBe(true);
  });

  it("clears both on reset", () => {
    const { result } = renderDedup();

    act(() => result.current.onArtistSelected(STEREOLAB));
    act(() => result.current.onGenreChange());
    act(() => result.current.reset());

    expect(result.current.existingArtist).toBeNull();
    expect(result.current.dedupCheckStale).toBe(false);
  });
});
