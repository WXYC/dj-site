import type { AlbumEntry } from "@/lib/features/catalog/types";
import {
  formatAlbumEntryLibraryCode,
  isVariousArtists,
} from "@/lib/features/catalog/libraryCode";
import { groupBinByShelf } from "@/lib/features/bin/shelfOrder";

/** Columns shared by every export format, in display order. */
const COLUMNS = ["Call #", "Artist", "Album", "Format"] as const;

/**
 * The library call number a DJ reads off the shelf: lettercode, artist number,
 * then the album's entry — e.g. `RO 12/3`, or `V/A-1` for a compilation.
 * Composed by the same formatter as catalog results (see Result.tsx), so a
 * volumed release prints its `-A` suffix and a Rock or Soundtracks compilation
 * its section letter, both read off the bin row. No genre prefix: this printout is one column among several,
 * with no room to repeat the genre the DJ already filed the bin by.
 */
export function callNumberFor(entry: AlbumEntry): string {
  return formatAlbumEntryLibraryCode(entry);
}

function headingFor(shelf: string): string {
  return `== ${shelf} ==`;
}

const VARIOUS_ARTISTS = "Various Artists";

/**
 * The artist as the printout names it. A compilation's artist row is a shelf
 * bucket (`Various Artists - Rock - N`) whose genre and letter the heading and
 * call number already carry, so it prints as plain `Various Artists`. A bucket
 * named some other way (`Soundtracks - M`) keeps its name, since dropping it
 * would leave nothing that says which shelf it is.
 */
function artistNameFor(entry: AlbumEntry): string {
  const name = entry.artist.name;
  const onCompilationShelf = isVariousArtists(entry.artist.lettercode ?? "");
  return onCompilationShelf &&
    name.trim().toLowerCase().startsWith(VARIOUS_ARTISTS.toLowerCase())
    ? VARIOUS_ARTISTS
    : name;
}

function cellsFor(entry: AlbumEntry): string[] {
  return [
    callNumberFor(entry),
    artistNameFor(entry),
    entry.title,
    entry.format ?? "",
  ].map((value) => (value ?? "").toString().trim());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Serializes the Mail Bin into the three shapes the export button needs, each
 * a run of `== <shelf> ==` headings with that shelf's albums beneath:
 *
 * - `tsv` — tab-separated rows for `text/plain`. Pasting this into Google
 *   Sheets (or Excel) splits it across cells, one album per row, with each
 *   heading alone in the first cell of its own row.
 * - `html` — a real `<table>` for `text/html`. Google Docs and Sheets both
 *   consume the rich-text flavor of the clipboard and render an actual table;
 *   each heading is a full-width row.
 * - `shareText` — human-readable lines for the Web Share sheet / an email
 *   body, where a raw TSV blob would look like noise.
 */
export function formatBinForExport(entries: AlbumEntry[]): {
  tsv: string;
  html: string;
  shareText: string;
} {
  const groups = groupBinByShelf(entries).map(({ shelf, entries }) => ({
    heading: headingFor(shelf),
    rows: entries.map(cellsFor),
  }));

  const tsv = [
    COLUMNS.join("\t"),
    ...groups.flatMap(({ heading, rows }) => [
      heading,
      ...rows.map((cols) => cols.join("\t")),
    ]),
  ].join("\n");

  const headerCells = COLUMNS.map((col) => `<th>${escapeHtml(col)}</th>`).join(
    "",
  );
  const bodyRows = groups
    .map(
      ({ heading, rows }) =>
        `<tr><th colspan="${COLUMNS.length}">${escapeHtml(heading)}</th></tr>` +
        rows
          .map(
            (cols) =>
              `<tr>${cols.map((col) => `<td>${escapeHtml(col)}</td>`).join("")}</tr>`,
          )
          .join(""),
    )
    .join("");
  const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;

  const shareText = [
    "WXYC Mail Bin",
    ...groups.flatMap(({ heading, rows }) => [
      "",
      heading,
      ...rows.map(([callNumber, artist, album]) => {
        const prefix = callNumber ? `[${callNumber}] ` : "";
        return `${prefix}${artist} — ${album}`;
      }),
    ]),
  ].join("\n");

  return { tsv, html, shareText };
}
