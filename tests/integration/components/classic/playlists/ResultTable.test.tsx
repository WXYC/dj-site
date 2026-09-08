import { describe, it, expect } from "vitest";
import { renderWithProviders } from "@/tests/helpers/render";
import ResultTable from "@/src/components/experiences/classic/playlists/ResultTable";
import type { PlaylistSearchResult } from "@wxyc/shared";

const results: PlaylistSearchResult[] = [
  {
    id: 1,
    play_date: "2024-06-15T14:30:00.000Z",
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
    dj_name: "Test DJ",
    show_id: 100,
  },
  {
    id: 2,
    play_date: "2024-06-15T14:33:00.000Z",
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
    dj_name: "Test DJ",
    show_id: 100,
  },
];

describe("Classic Previous Sets ResultTable", () => {
  // Six columns, matching tubafrenzy's searchPage results table
  // (Date · Artist · Song · Release · Label · DJ) and Modern's Results.tsx.
  // The former 5-column shape came from mostRecentEntries.jsp, the
  // show-in-progress flowsheet, which omits Date and DJ because every row
  // belongs to one show by one DJ.
  it("renders a 6-column header (Date · Artist · Song · Release · Label · DJ)", () => {
    const { container } = renderWithProviders(<ResultTable results={results} />);
    const headers = container.querySelectorAll("thead th");
    expect([...headers].map((h) => h.textContent)).toEqual([
      "Date",
      "Artist",
      "Song",
      "Release",
      "Label",
      "DJ",
    ]);
  });

  it("renders one row per result", () => {
    const { container } = renderWithProviders(<ResultTable results={results} />);
    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows.length).toBe(2);
  });

  it("renders an empty <tbody> when results is empty (caller gates rendering)", () => {
    // ResultTable does not own the empty-state message — its sole caller,
    // PreviousSetsContainer, surfaces "No results found" copy and gates
    // <ResultTable> on results.length > 0. Mirrors Modern's flow.
    const { container } = renderWithProviders(<ResultTable results={[]} />);
    expect(container.querySelectorAll("tbody tr").length).toBe(0);
  });
});
