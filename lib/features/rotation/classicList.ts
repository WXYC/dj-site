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
 * Distinct from "has a kill date", which is what the JSP's Killed column,
 * its Kill/Unkill choice and its Import affordance all key on
 * (`release.killDate == 0`). A future-dated kill is both: still in rotation
 * today, but already scheduled to leave. Conflating the two hides a
 * scheduled kill date behind a green "Active" and offers a Kill button for
 * a row that has already been killed.
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
 * ("unknown" here) for a never-killed, never-catalogued row -- it hasn't
 * been through a cataloging decision yet.
 */
export function rotationLibraryStatus(isLinked: boolean, hasKillDate: boolean): RotationLibraryStatus {
  if (isLinked) return "cataloged";
  return hasKillDate ? "uncataloged" : "unknown";
}

/** One row of the classic list's table, regardless of which endpoint produced it. */
export type RotationDisplayRow = {
  rotationId: number;
  artistName: string;
  title: string;
  label: string;
  /** The bin's own letter, which is what the JSP's Type column prints. */
  bin: RotationBin;
  formatName: string;
  addedDisplay: string;
  /**
   * The kill date as `MM/DD/YY`, or `null` for a row that has never been
   * killed. One value rather than a flag beside a string, so "killed with
   * no date" and "not killed but carrying one" are both unrepresentable.
   */
  killedDisplay: string | null;
  /** Whether the row still counts as in rotation today (a future kill hasn't landed). */
  active: boolean;
  libraryStatus: RotationLibraryStatus;
};

const EM_DASH = "\u2014";

/**
 * Projects a `GET /library/rotation` row (catalogued or uncatalogued) into
 * the shared display shape.
 *
 * `id` is `library.id` from Backend's LEFT JOIN and is the linkage
 * indicator -- `null` on an unlinked row. Checked with `hasLinkedAlbumId`
 * (its `> 0` guard) rather than a bare nullish check: while a `library.id`
 * can never actually be `0` (it is a `serial` starting at 1), asserting
 * that here would be trusting an invariant this client cannot see instead
 * of checking it.
 */
export function toDisplayRowFromList(row: RotationListRow, now: Date = new Date()): RotationDisplayRow {
  return {
    rotationId: row.rotation_id,
    artistName: row.artist_name ?? "",
    title: row.album_title ?? "",
    label: row.record_label ?? "",
    bin: row.rotation_bin,
    formatName: row.format_name ?? EM_DASH,
    addedDisplay: formatRotationDate(row.rotation_add_date),
    killedDisplay: row.rotation_kill_date == null ? null : formatRotationDate(row.rotation_kill_date),
    active: isRotationRowActive(row.rotation_kill_date, now),
    libraryStatus: rotationLibraryStatus(hasLinkedAlbumId(row.id), row.rotation_kill_date != null),
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
  return {
    rotationId: row.id,
    artistName: row.artist_name ?? "",
    title: row.album_title ?? "",
    label: row.record_label ?? "",
    bin: row.rotation_bin,
    formatName: EM_DASH,
    addedDisplay: formatRotationDate(row.add_date),
    killedDisplay: row.kill_date == null ? null : formatRotationDate(row.kill_date),
    active: isRotationRowActive(row.kill_date, now),
    libraryStatus: rotationLibraryStatus(hasLinkedAlbumId(row.album_id), row.kill_date != null),
  };
}

/**
 * A dedupe key from an artist/title pair, folded to collapse case and stray
 * whitespace.
 *
 * The two halves are encoded as a JSON array rather than joined by a
 * separator character. Any separator an artist name or album title could
 * itself contain makes `("Sun", "Ra Arkestra")` and `("Sun Ra",
 * "Arkestra")` one key, silently dropping one of the two releases from the
 * list; the separators that cannot appear in a title are all invisible
 * control characters, which no reader or diff can verify by eye.
 */
function dedupeKey(artistName: string | null, albumTitle: string | null): string {
  const fold = (value: string | null) => (value ?? "").normalize("NFC").trim().toLowerCase();
  return JSON.stringify([fold(artistName), fold(albumTitle)]);
}

/**
 * Most-recently-added first, tie-broken on the lowest rotation id so the
 * order is total. This is `rotationReleaseList.jsp`'s own Active-facet
 * order (`ORDER BY RR.ROTATION_ADD_DATE DESC` in `RotationReleaseServlet`),
 * and it is not the order the rows arrive in: `getRotationFromDB` orders by
 * its `DISTINCT ON` partition key first -- an `album_id`, or a `hashtext`
 * of the artist/title snapshot -- so the response reaches this client
 * grouped by a hash, with `add_date` only breaking ties inside a group.
 */
function byMostRecentlyAdded(left: RotationListRow, right: RotationListRow): number {
  if (left.rotation_add_date !== right.rotation_add_date) {
    return left.rotation_add_date < right.rotation_add_date ? 1 : -1;
  }
  return left.rotation_id - right.rotation_id;
}

/**
 * Sorts rotation rows most-recently-added first and collapses rows sharing
 * an artist and title, keeping the most recent of each group.
 *
 * Rotation rows genuinely duplicate in production -- `LOS THUTHANAKA /
 * Wak'a` appears three times across two days -- and Backend's own
 * `DISTINCT ON` in `getRotationFromDB` only collapses same `(album, bin)`
 * pairs, so a re-add under a different bin still arrives twice. The sort
 * belongs here rather than to the caller because "keep the first
 * occurrence" is only "keep the most recent" if the order is guaranteed,
 * and the response's own order guarantees the opposite: inside a duplicate
 * group the rows arrive ordered by bin letter, so taking the first would
 * pin the list to whichever bin sorts earliest -- showing a release still
 * in Heavy months after it moved to Light.
 *
 * Deliberately applied to the Active facet only, never to the Awaiting
 * Cataloging queue: `getUncataloguedRotationFromDB`'s own doc comment
 * states the opposite rule for that endpoint on purpose -- "two physically
 * distinct promos sharing an artist and title are two separate rows a
 * librarian has to catalogue" -- and re-collapsing them here would re-hide
 * one of them from the person whose job is to catalogue it.
 */
export function dedupeRotationListByArtistTitle(rows: RotationListRow[]): RotationListRow[] {
  const seen = new Set<string>();
  const result: RotationListRow[] = [];
  for (const row of [...rows].sort(byMostRecentlyAdded)) {
    const key = dedupeKey(row.artist_name, row.album_title);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}
