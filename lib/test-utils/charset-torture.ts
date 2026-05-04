import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CharsetTortureEntry {
  category: string;
  input: string;
  expected_storage: string;
  expected_match_form: string | null;
  expected_ascii_form: string | null;
  notes: string;
}

interface CharsetTortureCorpus {
  meta: { description: string; version: number };
  categories: Record<string, Omit<CharsetTortureEntry, "category">[]>;
}

const corpusPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/charset-torture.json"
);

const corpus: CharsetTortureCorpus = JSON.parse(
  readFileSync(corpusPath, "utf-8")
);

export const CHARSET_TORTURE_ENTRIES: CharsetTortureEntry[] = Object.entries(
  corpus.categories
).flatMap(([category, entries]) =>
  entries.map((e) => ({ ...e, category }))
);

export const charsetEntryId = (e: CharsetTortureEntry): string =>
  `${e.category}:${e.input.slice(0, 24).replace(/\n/g, "\\n")}`;
