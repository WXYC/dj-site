import type { AlbumEntry } from "@/lib/features/catalog/types";

/** Columns shared by every export format, in display order. */
const COLUMNS = ["Call #", "Album", "Artist", "Label", "Format"] as const;

/**
 * The library call number a DJ reads off the shelf: lettercode, artist number,
 * then the album's entry — e.g. `RO 12/3`. Matches the format shown on catalog
 * results (see Result.tsx). Missing parts collapse gracefully so a partial
 * record still yields something scannable.
 */
export function callNumberFor(entry: AlbumEntry): string {
  const { lettercode, numbercode } = entry.artist;
  const prefix = [lettercode, numbercode].filter((p) => p != null && p !== "").join(" ");
  return entry.entry != null ? `${prefix}/${entry.entry}`.trim() : prefix.trim();
}

function cellsFor(entry: AlbumEntry): string[] {
  return [
    callNumberFor(entry),
    entry.title,
    entry.artist.name,
    entry.label ?? "",
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
 * Serializes the Mail Bin into the three shapes the export button needs:
 *
 * - `tsv` — tab-separated rows for `text/plain`. Pasting this into Google
 *   Sheets (or Excel) splits it across cells, one album per row.
 * - `html` — a real `<table>` for `text/html`. Google Docs and Sheets both
 *   consume the rich-text flavor of the clipboard and render an actual table.
 * - `shareText` — human-readable lines for the Web Share sheet / an email
 *   body, where a raw TSV blob would look like noise.
 */
export function formatBinForExport(entries: AlbumEntry[]): {
  tsv: string;
  html: string;
  shareText: string;
} {
  const rows = entries.map(cellsFor);

  const tsv = [COLUMNS.join("\t"), ...rows.map((cols) => cols.join("\t"))].join(
    "\n",
  );

  const headerCells = COLUMNS.map((col) => `<th>${escapeHtml(col)}</th>`).join(
    "",
  );
  const bodyRows = rows
    .map(
      (cols) =>
        `<tr>${cols.map((col) => `<td>${escapeHtml(col)}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;

  const shareText = [
    "WXYC Mail Bin",
    "",
    ...rows.map(([callNumber, album, artist, label]) => {
      const suffix = label ? ` (${label})` : "";
      const prefix = callNumber ? `[${callNumber}] ` : "";
      return `${prefix}${album} — ${artist}${suffix}`;
    }),
  ].join("\n");

  return { tsv, html, shareText };
}
