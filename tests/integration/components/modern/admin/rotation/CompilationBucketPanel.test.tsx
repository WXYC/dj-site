import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import type { ArtistByCodeOwner } from "@/lib/features/catalog/types";

// Mock fonts before importing the modern theme (pulled in for the rotation palette).
vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { CssVarsProvider } from "@mui/joy/styles";
import modernTheme from "@/lib/features/experiences/modern/theme";
import CompilationBucketPanel, {
  type CompilationBucketPanelProps,
} from "@/src/components/experiences/modern/admin/rotation/CompilationBucketPanel";

const ROCK_SHELVES: ArtistByCodeOwner[] = [
  { id: 8110, artist_name: "Various Artists - Rock - H", code_letters: "V/A", code_number: 0, genre_id: 11 },
  { id: 8111, artist_name: "Various Artists - Rock - S", code_letters: "V/A", code_number: 0, genre_id: 11 },
];

const PLAIN_SHELF: ArtistByCodeOwner[] = [
  { id: 8301, artist_name: "Various Artists", code_letters: "V/A", code_number: 0, genre_id: 3 },
];

function renderPanel(overrides: Partial<CompilationBucketPanelProps> = {}) {
  const props: CompilationBucketPanelProps = {
    outcome: "picking",
    owners: ROCK_SHELVES,
    genreName: "Rock",
    resolvedArtistId: null,
    suggestedArtistId: null,
    onPick: vi.fn(),
    onRetry: vi.fn(),
    conflict: null,
    disabled: false,
    ...overrides,
  };
  return { props, ...renderWithProviders(
    <CssVarsProvider theme={modernTheme}>
      <CompilationBucketPanel {...props} />
    </CssVarsProvider>,
  ) };
}

function panel() {
  return screen.getByRole("region", { name: "Various Artists shelf" });
}

describe("CompilationBucketPanel — outcomes", () => {
  it("says it is still looking while the shelf resolves", () => {
    renderPanel({ outcome: "resolving", owners: [] });
    expect(within(panel()).getByText(/Finding this genre's Various Artists shelf/)).toBeInTheDocument();
  });

  it("names the genre's only shelf, with no choice to make", () => {
    renderPanel({ outcome: "existing", owners: PLAIN_SHELF, resolvedArtistId: 8301 });
    expect(within(panel()).getByText("Filing under Various Artists (V/A 0)")).toBeInTheDocument();
    expect(within(panel()).queryByRole("radio")).not.toBeInTheDocument();
  });

  it("lists the shelves verbatim when the genre has several", () => {
    renderPanel();
    expect(within(panel()).getByText("Which compilation shelf?")).toBeInTheDocument();
    // Names are shown exactly as the catalog holds them — the letter is the
    // only place the subdivision survives, so it is never trimmed or restyled.
    expect(within(panel()).getByLabelText("Various Artists - Rock - H")).not.toBeChecked();
    expect(within(panel()).getByLabelText("Various Artists - Rock - S")).not.toBeChecked();
  });

  it("reports a pick through onPick rather than holding it", async () => {
    const onPick = vi.fn();
    const { user } = renderPanel({ onPick });

    await user.click(within(panel()).getByLabelText("Various Artists - Rock - S"));

    expect(onPick).toHaveBeenCalledWith(8111);
    // Controlled: nothing moves until the owner of the value says so.
    expect(within(panel()).getByLabelText("Various Artists - Rock - S")).not.toBeChecked();
  });

  it("says a shelf was creating, for a genre with none", () => {
    renderPanel({ outcome: "create", owners: [] });
    expect(
      within(panel()).getByText(/First compilation in this genre/),
    ).toBeInTheDocument();
  });

  it("names a vanished genre and offers no retry, which could not help", () => {
    renderPanel({ outcome: "genre-missing", owners: [] });
    expect(within(panel()).getByRole("alert")).toHaveTextContent(
      /“Rock” is no longer in the catalog/,
    );
    expect(within(panel()).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("falls back to a genre-free sentence when the name is not on hand", () => {
    renderPanel({ outcome: "genre-missing", owners: [], genreName: null });
    expect(within(panel()).getByRole("alert")).toHaveTextContent(/That genre is no longer/);
  });

  it("offers a retry when the lookup could not be trusted", async () => {
    const onRetry = vi.fn();
    const { user } = renderPanel({ outcome: "unavailable", owners: [], onRetry });

    expect(within(panel()).getByRole("alert")).toHaveTextContent(
      /Couldn't check that library code right now/,
    );
    await user.click(within(panel()).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("CompilationBucketPanel — the suggestion", () => {
  it("captions the selected shelf when it came from the title", () => {
    renderPanel({ resolvedArtistId: 8110, suggestedArtistId: 8110 });

    expect(within(panel()).getByLabelText("Various Artists - Rock - H")).toBeChecked();
    expect(
      within(panel()).getByText(/Suggested from the title — change it if this files elsewhere/),
    ).toBeInTheDocument();
  });

  it("drops the caption once the librarian has chosen something else", () => {
    renderPanel({ resolvedArtistId: 8111, suggestedArtistId: 8110 });

    expect(within(panel()).getByLabelText("Various Artists - Rock - S")).toBeChecked();
    expect(within(panel()).queryByText(/Suggested from the title/)).not.toBeInTheDocument();
  });

  it("shows no caption when the title suggests nothing", () => {
    renderPanel({ resolvedArtistId: 8111, suggestedArtistId: null });
    expect(within(panel()).queryByText(/Suggested from the title/)).not.toBeInTheDocument();
  });
});

describe("CompilationBucketPanel — refusals and disabling", () => {
  it("states a refusal that names the shelf, with a way to look again", async () => {
    const onRetry = vi.fn();
    const { user } = renderPanel({
      outcome: "create",
      owners: [],
      conflict: { message: "Various Artists already holds V/A 0 in this genre." },
      onRetry,
    });

    expect(within(panel()).getByRole("alert")).toHaveTextContent(/already holds V\/A 0/);
    await user.click(within(panel()).getByRole("button", { name: "Look again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("locks every control while a filing is in flight", () => {
    renderPanel({
      resolvedArtistId: 8110,
      conflict: { message: "Refused." },
      disabled: true,
    });

    expect(within(panel()).getByLabelText("Various Artists - Rock - H")).toBeDisabled();
    expect(within(panel()).getByLabelText("Various Artists - Rock - S")).toBeDisabled();
    // A pick or a retry landing mid-submit would change the arm the request
    // was built from.
    expect(within(panel()).getByRole("button", { name: "Look again" })).toBeDisabled();
  });
});
