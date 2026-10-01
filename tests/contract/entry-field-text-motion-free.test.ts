import { describe, it, expect } from "vitest";
import { walkImportGraph } from "./import-graph";

/**
 * EntryFieldText.tsx is a hook-free, motion-free presentational module so a
 * future read-only surface can render a flowsheet field's view-mode text
 * without pulling `motion/react` or any live-show hook or API module into its
 * bundle. See entry-row-motion-free.test.ts's own comment for why the walk
 * fails closed on anything it can't prove static and clean.
 */

const ENTRY_FILE = "src/components/experiences/modern/flowsheet/Entries/EntryFieldText.tsx";

const BANNED_LOCAL_SPECIFIERS = [
  "@/src/hooks/flowsheetHooks",
  "@/src/hooks/authenticationHooks",
  "@/lib/features/bin/api",
  "@/lib/features/lml/api",
];

const BANNED_PACKAGE_SPECIFIERS = ["motion", "framer-motion", "motion-dom", "motion-utils"];

describe("EntryFieldText module graph (motion-free contract)", () => {
  it("imports nothing banned, statically or dynamically, from its own or any transitive import", () => {
    const { banned, dynamic, unresolved, files } = walkImportGraph(
      ENTRY_FILE,
      BANNED_LOCAL_SPECIFIERS,
      BANNED_PACKAGE_SPECIFIERS
    );

    expect(banned).toEqual([]);
    expect(dynamic).toEqual([]);
    expect(unresolved).toEqual([]);

    // A walk that stopped visiting imports would leave every list above
    // empty too, so this also proves it actually visited EntryFieldText's
    // own local imports rather than nothing at all.
    expect(files).toContain(ENTRY_FILE);
    expect(files).toContain("src/utilities/stringutilities.ts");
  });
});
