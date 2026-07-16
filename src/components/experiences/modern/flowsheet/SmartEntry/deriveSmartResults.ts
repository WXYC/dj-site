import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { FlowsheetSearchFilters } from "@/lib/features/flowsheet/types";
import type { FlowsheetResults } from "../Search/FlowsheetSearchProvider";
import { capResultGroups } from "../Search/Results/capResultGroups";
import type { SmartField } from "./parser/types";

export type SmartResultGroupKey = "bin" | "rotation" | "catalog" | "library";

export type SmartResultGroup = {
  key: SmartResultGroupKey;
  label: string;
  entries: AlbumEntry[];
};

export type SmartResultsModel = {
  groups: SmartResultGroup[];
  /** Groups flattened in display order — the index space for keyboard nav. */
  flat: AlbumEntry[];
};

const GROUP_LABELS: Record<SmartResultGroupKey, string> = {
  bin: "Your bin",
  rotation: "Rotation",
  catalog: "Card catalog",
  library: "Library",
};

const eq = (a: string | undefined, b: string) =>
  (a ?? "").toLowerCase() === b.toLowerCase();

/** A locked identity field must exact-match the result's corresponding field. */
function passesLocks(
  entry: AlbumEntry,
  locks: Partial<Record<SmartField, string>>
): boolean {
  if (locks.artist !== undefined && !eq(entry.artist?.name, locks.artist)) {
    return false;
  }
  if (locks.album !== undefined && !eq(entry.title, locks.album)) return false;
  if (locks.label !== undefined && !eq(entry.label, locks.label)) return false;
  // `song` is not a catalog/rotation field — a song lock never narrows results.
  return true;
}

/** Client-side filter across genre / format / rotation-bin dimensions. */
function passesFilters(
  entry: AlbumEntry,
  filters: FlowsheetSearchFilters
): boolean {
  if (
    filters.genres.length > 0 &&
    !filters.genres.includes(entry.artist?.genre ?? "")
  ) {
    return false;
  }
  if (filters.formats.length > 0 && !filters.formats.includes(entry.format)) {
    return false;
  }
  if (
    filters.rotationTags.length > 0 &&
    !(entry.rotation_bin && filters.rotationTags.includes(entry.rotation_bin))
  ) {
    return false;
  }
  return true;
}

/**
 * Shape the four raw search sources into the display model for the results
 * panel: apply locked-field narrowing and the active filters, dedupe an id to
 * the highest-priority group (bin → rotation → catalog → library), drop the
 * already-promoted selected match, then cap per group. Pure and unit-testable.
 */
export function deriveSmartResults({
  results,
  filters,
  locks,
  selectedMatchId,
  totalCap,
  baseCap,
}: {
  results: FlowsheetResults;
  filters: FlowsheetSearchFilters;
  locks: Partial<Record<SmartField, string>>;
  selectedMatchId: number | null;
  totalCap: number;
  baseCap: number;
}): SmartResultsModel {
  const ordered: Array<{ key: SmartResultGroupKey; entries: AlbumEntry[] }> = [
    { key: "bin", entries: results.binResults },
    { key: "rotation", entries: results.rotationResults },
    { key: "catalog", entries: results.catalogResults },
    { key: "library", entries: results.lmlResults },
  ];

  const seen = new Set<number>();
  const filtered = ordered.map(({ key, entries }) => ({
    key,
    entries: entries.filter((entry) => {
      if (entry.id === selectedMatchId) return false; // shown as Selected match
      if (seen.has(entry.id)) return false; // keep highest-priority group only
      if (!passesLocks(entry, locks)) return false;
      if (!passesFilters(entry, filters)) return false;
      seen.add(entry.id);
      return true;
    }),
  }));

  const capped = capResultGroups(
    filtered.map((g) => g.entries),
    totalCap,
    baseCap
  );

  const groups: SmartResultGroup[] = filtered
    .map((g, i) => ({
      key: g.key,
      label: GROUP_LABELS[g.key],
      entries: capped[i],
    }))
    .filter((g) => g.entries.length > 0);

  return { groups, flat: groups.flatMap((g) => g.entries) };
}
