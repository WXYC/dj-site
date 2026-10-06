import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CallNumberCase {
  id: string;
  why: string;
  genre: string | null;
  format: string | null;
  call_letters: string | null;
  artist_number: number | null;
  release_number: number | null;
  volume_letters: string | null;
  comp_letter: string | null;
  artist_name: string | null;
  full: string;
  /** `formatArtistCodeWithPunctuation`; null when the row has no artist half to render. */
  artist_half: string | null;
  /** `formatReleaseCode`; null when the row has no release number. */
  release_half: string | null;
}

const corpusPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "./call-number-cases.json"
);

export const CALL_NUMBER_CASES: CallNumberCase[] = JSON.parse(
  readFileSync(corpusPath, "utf-8")
).cases;
