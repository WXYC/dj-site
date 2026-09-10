import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
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

  // A real href, not a click handler: middle-click, copy-link and
  // open-in-new-tab are how a DJ compares two sets side by side.
  it("links the row to its show with the played track named for highlighting", () => {
    renderRow();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "?show=100&entry=1#entry-1"
    );
  });

  // Six per-cell links would announce the same destination six times.
  it("exposes exactly one link, named for the play it opens", () => {
    renderRow();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    // Leads with the date: an aria-label replaces the link's own text, and the
    // Date column has no other source for it.
    expect(links[0]).toHaveAccessibleName(
      "6/15/24 — see the full show for la paradoja by Juana Molina"
    );
  });

  // The backend projects a null show_id as 0, so a play that was never
  // attached to a show would otherwise link to a show that cannot exist.
  it("renders unlinked when the play belongs to no show", () => {
    const { container } = renderRow({ show_id: 0 });
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("tr > td")!.textContent).toBe("6/15/24");
  });
});
