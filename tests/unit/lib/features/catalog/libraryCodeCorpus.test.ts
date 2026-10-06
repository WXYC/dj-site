import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatArtistCodeWithPunctuation,
  formatReleaseCode,
} from "@/lib/features/catalog/libraryCode";
import {
  CALL_NUMBER_CASES,
  type CallNumberCase,
} from "@/tests/fixtures/call-number-cases";

const ROCK = 11;
const SOUNDTRACKS = 12;
const OTHER_GENRE = 1;

// Row id -> this repo's open ticket for it (`owner/repo#N`). A listed row is
// expected to fail; the self-check below fails once it passes, so the PR that
// closes the divergence deletes its own entry.
const KNOWN_DIVERGENCES: Record<string, string> = {};

const genreId = (genre: string | null): number | undefined =>
  genre === null ? undefined : genre === "Rock" ? ROCK : genre === "Soundtracks" ? SOUNDTRACKS : OTHER_GENRE;

function mismatches(c: CallNumberCase): string[] {
  const found: string[] = [];
  if (c.artist_half !== null) {
    const actual = formatArtistCodeWithPunctuation({
      code_letters: c.call_letters ?? "",
      code_artist_number: c.artist_number,
      genre_id: genreId(c.genre),
      code_comp_letter: c.comp_letter,
    });
    if (actual !== c.artist_half) found.push(`artist_half: ${actual} != ${c.artist_half}`);
  }
  if (c.release_half !== null) {
    const actual = formatReleaseCode({
      code_number: c.release_number ?? 0,
      code_volume_letters: c.volume_letters,
    });
    if (actual !== c.release_half) found.push(`release_half: ${actual} != ${c.release_half}`);
  }
  return found;
}

describe("call-number parity corpus", () => {
  it("matches the pinned sha256", () => {
    const dir = resolve(__dirname, "../../../../fixtures");
    const [pinned] = readFileSync(resolve(dir, "call-number-cases.json.sha256"), "utf-8").split(/\s+/);
    const actual = createHash("sha256").update(readFileSync(resolve(dir, "call-number-cases.json"))).digest("hex");
    expect(actual).toBe(pinned);
  });

  it.each(CALL_NUMBER_CASES.map((c) => [c.id, c] as const))("%s", (id, c) => {
    const found = mismatches(c);
    if (id in KNOWN_DIVERGENCES) {
      expect(found, `${id} now passes; delete its KNOWN_DIVERGENCES entry`).not.toEqual([]);
    } else {
      expect(found).toEqual([]);
    }
  });

  it("lists only rows that exist in the corpus", () => {
    const ids = new Set(CALL_NUMBER_CASES.map((c) => c.id));
    expect(Object.keys(KNOWN_DIVERGENCES).filter((id) => !ids.has(id))).toEqual([]);
  });
});
