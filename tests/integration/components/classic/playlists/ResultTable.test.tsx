import { describe, it, expect } from "vitest";
import { renderWithProviders } from "@/tests/helpers/render";
import ResultTable from "@/src/components/experiences/classic/playlists/ResultTable";
import type { PreviousSetsResult } from "@/src/components/experiences/classic/playlists/ResultRow";

const results: PreviousSetsResult[] = [
  {
    id: 1,
    play_date: "2024-06-15T14:30:00.000Z",
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
    dj_name: "Test DJ",
    show_id: 100,
    segue: true,
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
  it("renders a 5-column header (Indicators · Artist · Song · Release · Label)", () => {
    const { container } = renderWithProviders(<ResultTable results={results} />);
    const headers = container.querySelectorAll("thead th");
    expect(headers.length).toBe(5);
    expect(headers[1].textContent).toBe("Artist");
    expect(headers[2].textContent).toBe("Song");
    expect(headers[3].textContent).toBe("Release");
    expect(headers[4].textContent).toBe("Label");
  });

  it("renders one row per result", () => {
    const { container } = renderWithProviders(<ResultTable results={results} />);
    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows.length).toBe(2);
  });

  it("renders the segue indicator on the first row when the next row is also a song", () => {
    const { container } = renderWithProviders(<ResultTable results={results} />);
    const segueRows = container.querySelectorAll("tr.classic-segue");
    expect(segueRows.length).toBe(1);
    // The segue row is the first result row (id=1) because the second result follows it.
    expect(segueRows[0].getAttribute("data-segue")).toBe("true");
  });

  it("does NOT render any segue indicator when no row has segue=true", () => {
    const noSegueResults = results.map((r) => ({ ...r, segue: false }));
    const { container } = renderWithProviders(
      <ResultTable results={noSegueResults} />
    );
    expect(container.querySelector("tr.classic-segue")).toBeNull();
  });

  it("renders an empty <tbody> when results is empty (caller gates rendering)", () => {
    // ResultTable does not own the empty-state message — its sole caller,
    // PreviousSetsContainer, surfaces "No results found" copy and gates
    // <ResultTable> on results.length > 0. Mirrors Modern's flow.
    const { container } = renderWithProviders(<ResultTable results={[]} />);
    expect(container.querySelectorAll("tbody tr").length).toBe(0);
  });
});
