import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/tests/helpers";
import type { ArtistCodePeek } from "@/src/hooks/useArtistCodePeek";
import CallLetterPeekControl from "@/src/components/shared/inputs/CallLetterPeekControl";

// Display-only: the fetch, debounce, and staleness behavior live in
// useArtistCodePeek and are pinned through NewArtistFields, the hook's one
// production mount point. Here only the rendering of a given peek matters.

function peek(overrides: Partial<ArtistCodePeek> = {}): ArtistCodePeek {
  return {
    arg: {
      code_letters: TEST_SEARCH_STRINGS.CODE_LETTERS.MOLINA,
      genre_id: TEST_ENTITY_IDS.GENRE.ROCK,
    },
    pending: false,
    isError: false,
    nextCodeNumber: 7,
    ...overrides,
  };
}

describe("CallLetterPeekControl", () => {
  it("renders nothing while there is no complete pair to preview", () => {
    renderWithProviders(
      <CallLetterPeekControl peek={peek({ arg: null, nextCodeNumber: null })} />,
    );

    expect(screen.queryByText("Next code:")).not.toBeInTheDocument();
  });

  it("previews the peeked number", () => {
    renderWithProviders(<CallLetterPeekControl peek={peek()} />);

    expect(screen.getByTestId("next-code-number")).toHaveTextContent("7");
  });

  it("reports progress instead of a stale number while the peek is pending", () => {
    // `nextCodeNumber` still holds the previous pair's answer during the
    // debounce and fetch window; rendering it would present it as current.
    renderWithProviders(<CallLetterPeekControl peek={peek({ pending: true })} />);

    expect(screen.queryByTestId("next-code-number")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading next code number")).toBeInTheDocument();
  });

  it("names a failed peek rather than passing it off as a number", () => {
    renderWithProviders(
      <CallLetterPeekControl peek={peek({ isError: true, nextCodeNumber: null })} />,
    );

    expect(screen.getByText("Unable to preview code")).toBeInTheDocument();
  });
});
