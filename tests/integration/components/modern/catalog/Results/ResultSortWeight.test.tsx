import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";

vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { renderWithModernTheme as renderWithProviders } from "@/tests/helpers/renderModern";
import modernTheme from "@/lib/features/experiences/modern/theme";
import type { CatalogSortBy } from "@/lib/features/catalog/types";
import { formatAlbumEntryLibraryCode } from "@/lib/features/catalog/libraryCode";

const catalogSearch = vi.hoisted(() => ({ sortBy: "album" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/catalog",
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useLiveStatus: () => ({ live: false }),
  useQueue: () => ({ addToQueue: vi.fn() }),
}));

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogQuerySearch: () => ({
    selected: [],
    setSelection: vi.fn(),
    sortBy: catalogSearch.sortBy,
  }),
}));

// The bin control reaches useRegistry -> useAuthentication -> the better-auth
// session store, whose deferred teardown outlives this file's jsdom environment.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

import CatalogResult from "@/src/components/experiences/modern/catalog/Results/Result";

const ALBUM = createTestAlbum({
  title: "DOGA",
  artist: createTestArtist({ name: "Juana Molina" }),
  album_artist: "Juana Molina y Los Cantantes",
  label: "Sonamos",
  plays: 42,
});

// The modern theme loads 400 and 500 only: the sorted column is drawn at 500
// and every other column at 400, so exactly one column carries the emphasis.
// "date" sorts a column this table does not show, so no column is emphasized.
type Column = "album" | "artist" | "plays";

// jsdom leaves a Joy token as its `var(--<prefix>-fontWeight-<key>[, fallback])`
// and reports a rule-less element as "normal" (CSS: 400), so resolve both to
// the number the browser would draw.
function weightOf(element: HTMLElement): number {
  const declared = getComputedStyle(element).fontWeight;
  if (declared === "" || declared === "normal") {
    return 400;
  }
  const token = declared.match(/^var\(--[\w]+-fontWeight-(\w+)/);
  if (token) {
    return modernTheme.fontWeight[token[1] as "md"] as number;
  }
  return Number(declared);
}

function renderRow(sortBy: CatalogSortBy) {
  catalogSearch.sortBy = sortBy;
  renderWithProviders(
    <table>
      <tbody>
        <CatalogResult album={ALBUM} live={false} addToQueue={vi.fn()} />
      </tbody>
    </table>
  );
}

describe("CatalogResult sorted-column weight", () => {
  it.each<[CatalogSortBy, Column | null, string]>([
    ["album", "album", "only the album title"],
    ["artist", "artist", "only the artist, in both renderings,"],
    ["plays", "plays", "only the play count"],
    ["date", null, "no shown column"],
  ])("sorted by %s: %s is at 500", (sortBy, sortedColumn) => {
    renderRow(sortBy);
    const expected = (column: Column) => (column === sortedColumn ? 500 : 400);

    expect(weightOf(screen.getByTitle("DOGA"))).toBe(expected("album"));
    // The artist renders twice: stacked under the title below xl, and in its
    // own column at xl.
    const artists = screen.getAllByTitle("Juana Molina");
    expect(artists).toHaveLength(2);
    for (const artist of artists) {
      expect(weightOf(artist)).toBe(expected("artist"));
    }
    expect(weightOf(screen.getByText("42"))).toBe(expected("plays"));
  });

  it.each<CatalogSortBy>(["album", "artist", "plays", "date"])(
    "sorted by %s: the artist detail line, call number and label stay at 400",
    (sortBy) => {
      renderRow(sortBy);

      const details = screen.getAllByTitle("Juana Molina y Los Cantantes");
      expect(details).toHaveLength(2);
      for (const detail of details) {
        expect(weightOf(detail)).toBe(400);
      }
      expect(weightOf(screen.getByTitle("Sonamos"))).toBe(400);
      const callNumber = screen.getByText(formatAlbumEntryLibraryCode(ALBUM));
      expect(weightOf(callNumber)).toBe(400);
    }
  );
});
