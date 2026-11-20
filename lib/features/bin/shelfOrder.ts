import type { AlbumEntry } from "@/lib/features/catalog/types";
import { isVariousArtists } from "@/lib/features/catalog/libraryCode";

const COLLATOR = new Intl.Collator("en", { sensitivity: "base" });

type Medium = "vinyl" | "cd" | "other";

/**
 * Matched by substring because the format vocabulary is server-owned —
 * `12" Vinyl` is still a record and `CD-R` still a disc, and both belong on
 * their kind's shelf.
 */
function mediumOf(format: string | null | undefined): Medium {
  const f = (format ?? "").toLowerCase();
  if (f.includes("vinyl")) return "vinyl";
  if (f.includes("cd")) return "cd";
  return "other";
}

/** Case- and punctuation-insensitive, so `Hip-Hop` and `hiphop` meet. */
function genreKey(genre: string | null | undefined): string {
  return (genre ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCompilation(entry: AlbumEntry): boolean {
  return isVariousArtists(entry.artist?.lettercode ?? "");
}

type ShelfSection = {
  genres: readonly string[];
  medium: Medium;
  /** Restricts a section to compilations (`true`) or named artists (`false`). */
  compilation?: boolean;
};

/**
 * The station's walking order through the stacks. Rock compilations are
 * shelved apart from the named Rock artists — after them on vinyl, ahead of
 * them on CD — and each gets its own heading.
 * Genre spellings are the server's.
 */
const SHELF_SECTIONS: readonly ShelfSection[] = [
  { genres: ["Rock"], medium: "vinyl", compilation: false },
  { genres: ["Rock"], medium: "vinyl", compilation: true },
  { genres: ["Reggae"], medium: "vinyl" },
  { genres: ["Blues"], medium: "vinyl" },
  { genres: ["OCS"], medium: "vinyl" },
  { genres: ["Latin"], medium: "vinyl" },
  { genres: ["Africa"], medium: "vinyl" },
  { genres: ["Asia"], medium: "vinyl" },
  { genres: ["Reggae"], medium: "cd" },
  { genres: ["Rock"], medium: "cd", compilation: true },
  { genres: ["Rock"], medium: "cd", compilation: false },
  { genres: ["Classical"], medium: "vinyl" },
  { genres: ["Jazz"], medium: "vinyl" },
  { genres: ["Xmas"], medium: "vinyl" },
  { genres: ["Comedy"], medium: "vinyl" },
  { genres: ["Blues"], medium: "cd" },
  { genres: ["Soundtracks"], medium: "cd" },
  { genres: ["Electronic"], medium: "vinyl" },
  { genres: ["Hiphop"], medium: "vinyl" },
  { genres: ["Spoken"], medium: "vinyl" },
  { genres: ["Soundtracks"], medium: "vinyl" },
  { genres: ["Classical"], medium: "cd" },
  { genres: ["Jazz"], medium: "cd" },
  { genres: ["Xmas"], medium: "cd" },
  { genres: ["Electronic"], medium: "cd" },
  { genres: ["OCS"], medium: "cd" },
  { genres: ["Spoken"], medium: "cd" },
  { genres: ["Hiphop"], medium: "cd" },
  { genres: ["Asia"], medium: "cd" },
  { genres: ["Africa"], medium: "cd" },
  { genres: ["Latin"], medium: "cd" },
];

/** Index into `SHELF_SECTIONS`, or its length for a release on no listed shelf. */
function sectionOf(entry: AlbumEntry): number {
  const genre = genreKey(entry.artist?.genre);
  const medium = mediumOf(entry.format);
  const index = SHELF_SECTIONS.findIndex(
    (section) =>
      section.medium === medium &&
      section.genres.some((g) => genreKey(g) === genre) &&
      (section.compilation === undefined ||
        section.compilation === isCompilation(entry)),
  );
  return index === -1 ? SHELF_SECTIONS.length : index;
}

/**
 * The order a DJ pulls the bin off the shelves, used by both the Mail Bin panel
 * and its export: by `SHELF_SECTIONS`, then
 * named artists alphabetically with compilations after them, album title
 * breaking ties. Releases on no listed shelf follow, grouped by genre and
 * then format so each unlisted shelf still reads as one run.
 */
export function sortBinByShelf(entries: AlbumEntry[]): AlbumEntry[] {
  const unlisted = SHELF_SECTIONS.length;
  return entries
    .map((entry) => ({ entry, section: sectionOf(entry) }))
    .sort(
      (a, b) =>
        a.section - b.section ||
        (a.section === unlisted
          ? COLLATOR.compare(a.entry.artist?.genre ?? "", b.entry.artist?.genre ?? "") ||
            COLLATOR.compare(a.entry.format ?? "", b.entry.format ?? "")
          : 0) ||
        Number(isCompilation(a.entry)) - Number(isCompilation(b.entry)) ||
        COLLATOR.compare(a.entry.artist?.name ?? "", b.entry.artist?.name ?? "") ||
        COLLATOR.compare(a.entry.title ?? "", b.entry.title ?? ""),
    )
    .map(({ entry }) => entry);
}

/**
 * The shelf name a heading prints, e.g. `Rock vinyl`, `Rock CD V/A` or
 * `Jazz CD`. A release on no listed shelf is named by its own genre and format
 * as the server filed them.
 */
function shelfNameOf(entry: AlbumEntry, section: number): string {
  const listed = SHELF_SECTIONS[section];
  if (listed) {
    const medium = listed.medium === "vinyl" ? "vinyl" : "CD";
    const va = listed.compilation ? " V/A" : "";
    return `${listed.genres[0]} ${medium}${va}`;
  }
  const genre = entry.artist?.genre?.trim() || "Unknown";
  const format = entry.format?.trim() || "Unknown";
  return `${genre} ${format}`;
}

type ShelfGroup = { shelf: string; entries: AlbumEntry[] };

/** The sorted bin, split into runs that each sit on one named shelf. */
export function groupBinByShelf(entries: AlbumEntry[]): ShelfGroup[] {
  const groups: ShelfGroup[] = [];
  for (const entry of sortBinByShelf(entries)) {
    const shelf = shelfNameOf(entry, sectionOf(entry));
    const last = groups.at(-1);
    if (last?.shelf === shelf) last.entries.push(entry);
    else groups.push({ shelf, entries: [entry] });
  }
  return groups;
}
