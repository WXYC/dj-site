import { foldForSearch } from "../admin/roster-filter";
import { byMostRecentlyAdded } from "./classicList";
import {
  ROTATION_BINS,
  type FreeTextRotationAddRequest,
  type RotationBin,
  type RotationListRow,
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
 * (the server validates both as non-empty). The list read's `label_id` and
 * `format_name` are the library join's — null and absent by construction on
 * an unlinked row — so the rotation row's own pre-catalog FKs are not
 * re-fileable from here; the free-text trio is the whole carryable snapshot.
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
 * move lands.
 */
export function freeTextRotationMoveRequest(
  row: RotationListRow,
  targetBin: RotationBin,
): FreeTextRotationAddRequest | null {
  const snapshot = movableSnapshot(row);
  return snapshot == null ? null : { rotation_bin: targetBin, ...snapshot };
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
