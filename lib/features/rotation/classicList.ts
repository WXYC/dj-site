import { hasLinkedAlbumId } from "../flowsheet/linkage";
import type { RotationBin, RotationListRow, UncataloguedRotationRow } from "./types";

/**
 * The viewer's local calendar day as `YYYY-MM-DD`. Deliberately local, not
 * UTC: `rotation.kill_date`/`rotation.add_date` are plain SQL `date` columns
 * with no time component, and the station's DJs and the database both live
 * in Eastern time -- comparing against a UTC "today" would misclassify a row
 * killed earlier today as still-active for however many hours UTC runs
 * ahead of the viewer's evening (the same trap `rotationApi`'s
 * `killRotationEntry` comment documents for the write side).
 */
function localTodayISO(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * A rotation row is active when it has never been killed, or its kill date
 * hasn't arrived yet -- mirrors `getRotationFromDB`'s own
 * `kill_date IS NULL OR kill_date > CURRENT_DATE` predicate, reproduced
 * client-side because the Awaiting Cataloging queue (`GET
 * /library/rotation/uncatalogued`) is deliberately NOT status-filtered
 * server-side and mixes active and killed rows in one response.
 *
 * Plain string comparison on `YYYY-MM-DD`, not a `Date` parse: a date-only
 * string has no timezone to get wrong, and lexicographic comparison of two
 * zero-padded ISO dates is exactly calendar-day comparison.
 */
export function isRotationRowActive(killDate: string | null, now: Date = new Date()): boolean {
  if (killDate == null) return true;
  return killDate > localTodayISO(now);
}

/**
 * `MM/DD/YY`, matching `rotationReleaseList.jsp`'s
 * `DateTimeManager.getLongDateAsMMDDYY`. Reads the ISO string's own digits
 * rather than round-tripping through `Date` -- a date-only string parsed
 * with `new Date(...)` is UTC midnight, which a viewer west of UTC renders
 * as the previous calendar day.
 */
export function formatRotationDate(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year.slice(2)}`;
}

export type RotationLibraryStatus = "cataloged" | "uncataloged" | "unknown";

/**
 * The JSP's Library column: Cataloged when linked (regardless of kill
 * status), Uncataloged when killed and never linked, and an em-dash
 * ("unknown" here) for a still-active, never-catalogued row -- it hasn't
 * been through a cataloging decision yet.
 */
export function rotationLibraryStatus(isLinked: boolean, isKilled: boolean): RotationLibraryStatus {
  if (isLinked) return "cataloged";
  return isKilled ? "uncataloged" : "unknown";
}

/** One row of the classic list's table, regardless of which endpoint produced it. */
export type RotationDisplayRow = {
  rotationId: number;
  artistName: string;
  title: string;
  label: string;
  binLabel: RotationBin;
  formatName: string;
  addedDisplay: string;
  killed: boolean;
  killedDisplay: string;
  libraryStatus: RotationLibraryStatus;
  showImport: boolean;
};

const EM_DASH = "—";

function killedDisplay(killDate: string | null): string {
  return killDate == null ? "Active" : formatRotationDate(killDate);
}

/**
 * Projects a `GET /library/rotation` row (catalogued or uncatalogued,
 * active-only by construction) into the shared display shape.
 *
 * `id` is `library.id` from Backend's LEFT JOIN and is the linkage
 * indicator -- `null` on an unlinked row. Checked with `hasLinkedAlbumId`
 * (its `> 0` guard) rather than a bare nullish check: the unlinked sentinel
 * is both `0` (tubafrenzy's convention) and `NULL` (Backend's), and while a
 * `library.id` can never actually be `0` (it's a `serial` starting at 1),
 * asserting that here would be trusting the invariant instead of checking
 * it.
 */
export function toDisplayRowFromList(row: RotationListRow, now: Date = new Date()): RotationDisplayRow {
  const isLinked = hasLinkedAlbumId(row.id);
  const active = isRotationRowActive(row.rotation_kill_date, now);
  return {
    rotationId: row.rotation_id,
    artistName: row.artist_name ?? "",
    title: row.album_title ?? "",
    label: row.record_label ?? "",
    binLabel: row.rotation_bin,
    formatName: row.format_name ?? EM_DASH,
    addedDisplay: formatRotationDate(row.rotation_add_date),
    killed: !active,
    killedDisplay: killedDisplay(row.rotation_kill_date),
    libraryStatus: rotationLibraryStatus(isLinked, !active),
    showImport: !active && !isLinked,
  };
}

/**
 * Projects a `GET /library/rotation/uncatalogued` row into the shared
 * display shape. Every row from this endpoint is unlinked by construction
 * (`album_id IS NULL` is the query's whole predicate), so `libraryStatus`
 * can only ever read `uncataloged` or `unknown` here -- `album_id` is still
 * checked with `hasLinkedAlbumId` rather than assumed, so a future change to
 * the endpoint's predicate would show as a Cataloged row here instead of
 * silently mislabeling one as Uncataloged.
 */
export function toDisplayRowFromUncatalogued(
  row: UncataloguedRotationRow,
  now: Date = new Date(),
): RotationDisplayRow {
  const isLinked = hasLinkedAlbumId(row.album_id);
  const active = isRotationRowActive(row.kill_date, now);
  return {
    rotationId: row.id,
    artistName: row.artist_name ?? "",
    title: row.album_title ?? "",
    label: row.record_label ?? "",
    binLabel: row.rotation_bin,
    formatName: EM_DASH,
    addedDisplay: formatRotationDate(row.add_date),
    killed: !active,
    killedDisplay: killedDisplay(row.kill_date),
    libraryStatus: rotationLibraryStatus(isLinked, !active),
    showImport: !active && !isLinked,
  };
}

/** A dedupe key from an artist/title pair: folded to collapse case and stray whitespace. */
function dedupeKey(artistName: string | null, albumTitle: string | null): string {
  const fold = (value: string | null) => (value ?? "").normalize("NFC").trim().toLowerCase();
  return `${fold(artistName)} ${fold(albumTitle)}`;
}

/**
 * Collapses rotation rows that share an artist and title, keeping the first
 * occurrence. Rotation rows genuinely duplicate in production --
 * `LOS THUTHANAKA / Wak'a` appears three times across two days -- and
 * Backend's own `DISTINCT ON` in `getRotationFromDB` only collapses same
 * `(album, bin)` pairs, not a re-add under a different bin.
 *
 * Callers pass rows already ordered most-recent-first (Backend's own
 * `ORDER BY add_date DESC, id ASC`), so "first occurrence" is "most
 * recent" without this function needing to know about dates at all.
 *
 * Deliberately applied to the Active facet only, never to the Awaiting
 * Cataloging queue: `getUncataloguedRotationFromDB`'s own doc comment states
 * the opposite rule for that endpoint on purpose -- "two physically distinct
 * promos sharing an artist and title are two separate rows a librarian has
 * to catalogue" -- and re-collapsing them here would reintroduce the exact
 * bug (#862) that comment describes fixing.
 */
export function dedupeRotationListByArtistTitle(rows: RotationListRow[]): RotationListRow[] {
  const seen = new Set<string>();
  const result: RotationListRow[] = [];
  for (const row of rows) {
    const key = dedupeKey(row.artist_name, row.album_title);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}
