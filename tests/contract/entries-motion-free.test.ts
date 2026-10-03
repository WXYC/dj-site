import { describe, it, expect } from "vitest";
import { walkImportGraph } from "@/tests/helpers/import-graph";

/**
 * Every motion-free, hook-free presentational module under
 * src/components/experiences/modern/flowsheet/Entries/ exists so a
 * read-only surface can render a piece of the live row without pulling
 * `motion/react` or any live-show hook or API module into its bundle --
 * ReadOnlyEntry.tsx (under Entries/ReadOnly/) is that surface, composing all
 * five. A later edit that reaches for one of those from inside one of these
 * modules -- even transitively, even via a dynamic `import()` this walk
 * can't resolve a destination for -- silently reopens that bundle, so the
 * walk fails closed on anything it can't prove static and clean: a banned
 * import, a dynamic import it can't resolve, or a local import (`@/...` or
 * relative) that resolves to no file at all. ArchiveStreamTable.tsx, the
 * shared chronological table of read-only rows, is held to the same walk on
 * the same terms as the row it renders. One parameterized test covers
 * every module in the family rather than a near-identical copy per module,
 * so a new banned specifier only has to be added once.
 */

// Local modules none of these modules' graphs may ever reach, named however
// a specifier might spell them (the `@/` alias, a relative path, baseUrl's
// bare form, or with an explicit extension) -- matched by resolved file, not
// text.
const BANNED_LOCAL_SPECIFIERS = [
  "@/src/hooks/flowsheetHooks",
  "@/src/hooks/authenticationHooks",
  "@/lib/features/bin/api",
  "@/lib/features/lml/api",
  "@/lib/features/schedule-week/api",
];

// Motion's own package entry points, plus the two packages that hold its
// engine and are directly importable rather than reachable only as a
// subpath of motion/framer-motion. Banning a package root also bans every
// subpath under it (motion/react, motion/react-client, motion/react-m,
// motion/react-mini, motion-dom/..., motion-utils/..., ...), so these four
// roots cover every way one of these modules could reopen the motion bundle.
const BANNED_PACKAGE_SPECIFIERS = ["motion", "framer-motion", "motion-dom", "motion-utils"];

const MODULES = [
  {
    name: "EntryRow",
    file: "src/components/experiences/modern/flowsheet/Entries/EntryRow.tsx",
    // A walk that stopped visiting imports would leave banned/dynamic/
    // unresolved empty too, so asserting a transitive file is reached also
    // proves the walk actually followed EntryRow's own local imports.
    mustContain: ["lib/features/flowsheet/types.ts", "lib/features/schedule-week/showUrl.ts"],
  },
  {
    name: "EntryFieldText",
    file: "src/components/experiences/modern/flowsheet/Entries/EntryFieldText.tsx",
    mustContain: ["src/utilities/stringutilities.ts"],
  },
  {
    name: "EntryArtwork",
    file: "src/components/experiences/modern/flowsheet/Entries/EntryArtwork.tsx",
    mustContain: [
      "lib/features/flowsheet/types.ts",
      "src/components/experiences/modern/catalog/AlbumArtwork.tsx",
    ],
  },
  {
    name: "AlbumInfoButton",
    file: "src/components/experiences/modern/flowsheet/Entries/AlbumInfoButton.tsx",
    mustContain: ["lib/features/flowsheet/types.ts"],
  },
  {
    name: "messageEntrySlots",
    file: "src/components/experiences/modern/flowsheet/Entries/messageEntrySlots.tsx",
    mustContain: [
      "src/components/experiences/modern/flowsheet/Entries/entryPresentation.ts",
      "src/components/experiences/modern/flowsheet/Entries/Components/DateTimeStack.tsx",
    ],
  },
  {
    name: "ReadOnlyEntry",
    file: "src/components/experiences/modern/flowsheet/Entries/ReadOnly/ReadOnlyEntry.tsx",
    // Proves the read-only row actually composes the five modules above
    // (not copies of them) rather than merely avoiding the same banned
    // imports they do.
    mustContain: [
      "src/components/experiences/modern/flowsheet/Entries/EntryRow.tsx",
      "src/components/experiences/modern/flowsheet/Entries/EntryFieldText.tsx",
      "src/components/experiences/modern/flowsheet/Entries/EntryArtwork.tsx",
      "src/components/experiences/modern/flowsheet/Entries/messageEntrySlots.tsx",
      "src/components/experiences/modern/flowsheet/Entries/AlbumInfoButton.tsx",
    ],
  },  {
    name: "ArchiveStreamTable",
    file: "src/components/experiences/modern/previous-sets/ArchiveStreamTable.tsx",
    // The shared table reaches the read-only row and the notice it renders
    // outside its table, and the showUrl helper its row links are built with.
    mustContain: [
      "src/components/experiences/modern/flowsheet/Entries/ReadOnly/ReadOnlyEntry.tsx",
      "src/components/experiences/modern/previous-sets/FailedSearchNotice.tsx",
      "lib/features/schedule-week/showUrl.ts",
    ],
  },
];

describe.each(MODULES)("$name module graph (motion-free contract)", ({ file, mustContain }) => {
  it("imports nothing banned, statically or dynamically, from its own or any transitive import", () => {
    const { banned, dynamic, unresolved, files } = walkImportGraph(
      file,
      BANNED_LOCAL_SPECIFIERS,
      BANNED_PACKAGE_SPECIFIERS
    );

    expect(banned).toEqual([]);
    expect(dynamic).toEqual([]);
    expect(unresolved).toEqual([]);

    expect(files).toContain(file);
    for (const transitive of mustContain) {
      expect(files).toContain(transitive);
    }
  });
});
