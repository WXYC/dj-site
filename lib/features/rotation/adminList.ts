import { foldForSearch } from "../admin/roster-filter";
import { byMostRecentlyAdded } from "./classicList";
import {
  ROTATION_BINS,
  type FreeTextRotationAddRequest,
  type RotationBin,
  type RotationListRow,
  type RotationRowSummary,
  type RotationStatusFilter,
} from "./types";

/**
 * Pure selection logic for the modern Rotation Admin list — the `status=all`
 * read filtered by search text, a bin, and a card, split into its two
 * presentations.
 *
 * Deliberately never deduped, unlike the classic Active facet
 * (`dedupeRotationListByArtistTitle`): this is a management surface, and a
 * re-add under a second bin is two real rows an MD may need to kill
 * separately — collapsing them would hide one from the person whose job is
 * to manage it.
 */

/**
 * The two presentations a `status=all` row lands in. A subset of the
 * existing facet vocabulary rather than a new type: "active" and "killed"
 * here are the same claims the classic chip bar and the server's `status=`
 * param make, and a parallel spelling could drift from them.
 */
export type RotationRowPresentation = Extract<RotationStatusFilter, "active" | "killed">;

/**
 * Which presentation a row belongs to. Keys on kill-date *presence*, never on
 * whether the date has arrived — the same predicate the Kill/Unkill choice
 * uses (distinct from `isRotationRowActive`, which asks "in rotation
 * today?"). A future-dated kill therefore renders as killed, shows its date,
 * and offers Unkill; grouping on arrival instead would pair a Kill button
 * with a row that is already scheduled to die.
 */
export function rotationRowPresentation(row: RotationListRow): RotationRowPresentation {
  return row.rotation_kill_date == null ? "active" : "killed";
}

/**
 * The row's shelf code as the card catalog spells it (`Rock SL 1/3`), or
 * `null` for a row whose release was never catalogued — the code columns are
 * the library join's and are all null on an unlinked row.
 */
export function rotationRowCode(row: RotationListRow): string | null {
  if (row.code_letters == null || row.code_artist_number == null || row.code_number == null) {
    return null;
  }
  const code = `${row.code_letters} ${row.code_artist_number}/${row.code_number}`;
  return row.genre_name == null ? code : `${row.genre_name} ${code}`;
}

/**
 * The snapshot an unlinked row (`id: null`) can carry into a re-filing, or
 * `null` when the row lacks the artist or title the free-text add requires
 * (the server validates both as non-empty). Only the free-text trio: the
 * list read's `label_id` and `format_name` are the library join's — null
 * and absent by construction on an unlinked row — so the rotation row's own
 * pre-catalog `format_id`/`label_id` are not readable from the list row.
 * They ARE published by the single-row read (`GET /library/rotation/:id`),
 * which is why `freeTextRotationMoveRequest` takes that read's answer
 * alongside the row.
 */
function movableSnapshot(
  row: RotationListRow,
): Pick<FreeTextRotationAddRequest, "artist_name" | "album_title" | "record_label"> | null {
  const artist = row.artist_name?.trim();
  const title = row.album_title?.trim();
  if (!artist || !title) return null;
  const label = row.record_label?.trim();
  // `record_label` is optional-and-omitted, never null: the endpoint picks
  // it with `!= null`, so "no label" must be an absent key.
  return { artist_name: artist, album_title: title, ...(label ? { record_label: label } : {}) };
}

/**
 * The `POST /library/rotation` body that re-files an unlinked row in another
 * bin. Deliberately no `card_id`: an omitted card files the row on the
 * target bin's newest card — the server's own defaulting, exactly where a
 * move lands. Everything else the source row holds IS carried, because the
 * move retires that row and the record's data would die with it: the trio
 * and `urls` from the row itself, and the pre-catalog `format_id`/`label_id`
 * from `detail` — the single-row read's answer, the one place those fields
 * are readable (see `movableSnapshot`). All three optional fields are
 * omitted-never-null, matching the endpoint's `!= null` pick.
 */
export function freeTextRotationMoveRequest(
  row: RotationListRow,
  targetBin: RotationBin,
  detail: Pick<RotationRowSummary, "format_id" | "label_id">,
): FreeTextRotationAddRequest | null {
  const snapshot = movableSnapshot(row);
  if (snapshot == null) return null;
  return {
    rotation_bin: targetBin,
    ...snapshot,
    ...(detail.format_id != null ? { format_id: detail.format_id } : {}),
    ...(detail.label_id != null ? { label_id: detail.label_id } : {}),
    ...(row.urls?.length ? { urls: row.urls } : {}),
  };
}

/**
 * One half of the list read's collapse identity: `lower(coalesce(field, ''))`
 * — the exact normalization inside `getRotationFromDB`'s partition-key hash,
 * mirrored precisely (lowercase only; no trim, no diacritic folding), so
 * this module and the read agree row for row on which entries are one.
 */
const unlinkedIdentityPart = (value: string | null): string => (value ?? "").toLowerCase();

/**
 * Every rotation_id a move of `row` into `targetBin` must retire: the moved
 * row, plus any other active row the same release already holds in the
 * target bin. `addThenRetire`'s ordering is justified by a leftover
 * duplicate being visible and recoverable — true across bins, false within
 * one: the list read collapses per (identity, bin), so two active rows in
 * one bin collapse to a single row on every consuming surface. Moving into
 * a bin the release is already active in would stack exactly that invisible
 * duplicate; retiring the target bin's own entry alongside the source makes
 * the move the consolidation the operator sees.
 *
 * "Same release" is the read's own identity, which is per-arm: `album_id`
 * for a linked row, and for an unlinked one the lowercased (artist_name,
 * album_title) pair — the partition key coalesces to a hash of
 * `lower(coalesce(artist_name,'')) || '|' || lower(coalesce(album_title,''))`
 * in `album_id`'s absence, kept strictly negative so the two arms can never
 * collapse with each other. The duplicate match mirrors that split exactly:
 * a linked and an unlinked row are never each other's duplicate, however
 * alike their titles.
 */
export function rotationMoveRetireIds(
  rows: readonly RotationListRow[],
  row: RotationListRow,
  targetBin: RotationBin,
): number[] {
  const sameIdentity =
    row.id != null
      ? (candidate: RotationListRow) => candidate.id === row.id
      : (candidate: RotationListRow) =>
          candidate.id == null &&
          unlinkedIdentityPart(candidate.artist_name) === unlinkedIdentityPart(row.artist_name) &&
          unlinkedIdentityPart(candidate.album_title) === unlinkedIdentityPart(row.album_title);
  const targetBinDuplicates = rows
    .filter(
      (candidate) =>
        candidate.rotation_id !== row.rotation_id &&
        candidate.rotation_bin === targetBin &&
        rotationRowPresentation(candidate) === "active" &&
        sameIdentity(candidate),
    )
    .map((candidate) => candidate.rotation_id);
  return [row.rotation_id, ...targetBinDuplicates];
}

/**
 * Whether a row can be re-filed in another bin at all: a catalogued row
 * always can (the add names its library release), an unlinked one only when
 * its snapshot satisfies the free-text add. A row this refuses renders its
 * bin as a fact rather than an affordance.
 */
export function canMoveRotationRow(row: RotationListRow): boolean {
  return row.id != null || movableSnapshot(row) != null;
}

/** Split a raw query into the folded terms every match must satisfy — the roster search's own shape. */
function searchTerms(query: string): string[] {
  return foldForSearch(query).split(/\s+/).filter(Boolean);
}

/**
 * Terms match independently across artist, title, and shelf code, folded
 * case- and diacritic-insensitively (`nilufer` finds Nilüfer Yanya), so
 * "stereolab holograms" narrows to the one row carrying both and word order
 * does not matter.
 */
function rowMatchesTerms(row: RotationListRow, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = [row.artist_name ?? "", row.album_title ?? "", rotationRowCode(row) ?? ""].map(
    foldForSearch,
  );
  return terms.every((term) => haystack.some((field) => field.includes(term)));
}

/** The admin list's three composable filters. `null` means "not narrowing". */
export type RotationAdminQuery = {
  search: string;
  bin: RotationBin | null;
  cardId: number | null;
};

export type RotationAdminView = {
  /** Rows passing every filter, in each presentation, most recently added first. */
  active: RotationListRow[];
  killed: RotationListRow[];
  /** Whole-dataset totals — the "of N" the section heads report against. */
  activeTotal: number;
  killedTotal: number;
  /** Whether any filter narrows the list, i.e. whether the heads read "N of total". */
  narrowed: boolean;
  /** Search-scoped active count behind the "All" bin chip. */
  searchedActiveCount: number;
  /** Search-scoped active count per bin, behind each bin chip. Every bin has an entry. */
  binCounts: ReadonlyMap<RotationBin, number>;
  /**
   * Search-scoped active count per card id within the selected bin, behind
   * the card sub-filter chips. Empty when no single bin is selected — the
   * sub-filter only exists then. A card with no rows is simply absent;
   * callers render its chip from the cards read and default the count to 0.
   */
  cardCounts: ReadonlyMap<number, number>;
};

/**
 * Composes the three filters over a `status=all` read.
 *
 * The chip counts are search-scoped but not chip-scoped: each bin chip
 * reports how many searched active rows selecting it would show, so the
 * counts stay meaningful while a different chip is selected. The card filter
 * matches on the card's id (its stable identity), so an uncarded row is
 * visible under "All cards" and under no card chip.
 */
export function selectRotationAdminView(
  rows: RotationListRow[],
  query: RotationAdminQuery,
): RotationAdminView {
  const terms = searchTerms(query.search);
  const searched = [...rows].sort(byMostRecentlyAdded).filter((row) => rowMatchesTerms(row, terms));
  const searchedActive = searched.filter((row) => rotationRowPresentation(row) === "active");

  const binCounts = new Map<RotationBin, number>(ROTATION_BINS.map((bin) => [bin, 0]));
  for (const row of searchedActive) {
    binCounts.set(row.rotation_bin, (binCounts.get(row.rotation_bin) ?? 0) + 1);
  }

  const cardCounts = new Map<number, number>();
  if (query.bin != null) {
    for (const row of searchedActive) {
      if (row.rotation_bin !== query.bin || row.card?.id == null) continue;
      cardCounts.set(row.card.id, (cardCounts.get(row.card.id) ?? 0) + 1);
    }
  }

  const shown = searched.filter(
    (row) =>
      (query.bin == null || row.rotation_bin === query.bin) &&
      (query.cardId == null || row.card?.id === query.cardId),
  );
  const activeTotal = rows.filter((row) => rotationRowPresentation(row) === "active").length;

  return {
    active: shown.filter((row) => rotationRowPresentation(row) === "active"),
    killed: shown.filter((row) => rotationRowPresentation(row) === "killed"),
    activeTotal,
    killedTotal: rows.length - activeTotal,
    narrowed: terms.length > 0 || query.bin != null || query.cardId != null,
    searchedActiveCount: searchedActive.length,
    binCounts,
    cardCounts,
  };
}
