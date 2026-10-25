import { describe, it, expect } from "vitest";
import * as showPlaylistApi from "@/lib/features/show-playlist/api";

const BANNED = /spotlight|dj-site/i;

// A module that must say a banned word declares itself here with a reason. None does today.
const EXCEPTIONS: Record<string, string> = {};

// Argument lists a copy function may take: a role, a program, a slot with a name or names, a name.
const PROGRAM = { name: "Porch Static", short_name: "Porch" };
const ARGUMENT_LISTS: unknown[][] = [
  [undefined],
  [null],
  ["dj"],
  ["guest"],
  ["performer"],
  ["reader"],
  [PROGRAM],
  ["Sunday at noon", "Porch Static"],
  ["Sunday at noon", ["Porch Static", "Stereolab"]],
  ["Porch Static"],
];

function strings(value: unknown, path: string): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "function") {
    const results = ARGUMENT_LISTS.flatMap((args) => {
      try {
        return strings(value(...args), path);
      } catch {
        return [];
      }
    });
    expect(results, `${path} returned no string for any argument list in the guard's table`).not.toEqual([]);
    return results;
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => strings(child, `${path}.${key}`));
  }
  return [];
}

// Top-level functions are helpers, not copy; copy lives in strings and in objects of strings and functions.
const copyModules = Object.entries(
  import.meta.glob("../../../lib/**/*copy*.ts", { eager: true }) as Record<string, Record<string, unknown>>
).filter(([file]) => !(file in EXCEPTIONS));

const sentenceConstants = Object.entries(showPlaylistApi).filter(([name]) => name.endsWith("_SENTENCE"));

const exported = [
  ...copyModules.flatMap(([file, mod]) =>
    Object.entries(mod)
      .filter(([, value]) => typeof value !== "function")
      .map(([name, value]) => [`${file}#${name}`, value] as const)
  ),
  ...sentenceConstants.map(([name, value]) => [`show-playlist/api#${name}`, value] as const),
];

describe("DJ-facing copy", () => {
  it("finds the copy modules and sentence constants", () => {
    const names = exported.map(([name]) => name);
    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringContaining("whos-on-copy.ts#whosOnCopy"),
        expect.stringContaining("request-line-copy.ts#requestLineCopy"),
        expect.stringContaining("specialty/copy.ts#specialtyCopy"),
        expect.stringContaining("specialty/copy.ts#REJECTED_PROGRAM_SENTENCE"),
        "show-playlist/api#CLOSED_SHOW_SENTENCE",
      ])
    );
  });

  it.each(exported)("%s never says spotlight or dj-site", (name, value) => {
    expect(strings(value, name).filter((text) => BANNED.test(text))).toEqual([]);
  });
});
