import { describe, it, expect } from "vitest";
import { renderWithProviders } from "@/tests/helpers/render";
import ResultRow from "@/src/components/experiences/classic/playlists/ResultRow";
import type { PlaylistSearchResult } from "@wxyc/shared";

const baseResult: PlaylistSearchResult = {
  id: 1,
  play_date: "2024-06-15T14:30:00.000Z",
  artist_name: "Juana Molina",
  track_title: "la paradoja",
  album_title: "DOGA",
  record_label: "Sonamos",
  dj_name: "Test DJ",
  show_id: 100,
};

function renderRow(over: Partial<PlaylistSearchResult> = {}) {
  return renderWithProviders(
    <table>
      <tbody>
        <ResultRow result={{ ...baseResult, ...over }} />
      </tbody>
    </table>
  );
}

describe("Classic Previous Sets ResultRow", () => {
  it("renders the six search columns in order", () => {
    const { container } = renderRow();
    const tds = container.querySelectorAll("tr > td");
    expect([...tds].map((td) => td.textContent)).toEqual([
      "6/15/24",
      "Juana Molina",
      "la paradoja",
      "DOGA",
      "Sonamos",
      "Test DJ",
    ]);
  });

  // 14:30 UTC is the 15th in both zones; 02:30 UTC on the 16th is still the
  // 15th at the station. Filing a late-night play under the reader's calendar
  // day would put it in a set that did not air that day.
  it("dates a play by the station's calendar day, not the reader's", () => {
    const { container } = renderRow({
      play_date: "2024-06-16T02:30:00.000Z",
    });
    expect(container.querySelector("tr > td")!.textContent).toBe("6/15/24");
  });

  it("renders empty cells rather than dropping them when fields are blank", () => {
    const { container } = renderRow({ record_label: "", dj_name: "" });
    expect(container.querySelectorAll("tr > td").length).toBe(6);
  });
});
