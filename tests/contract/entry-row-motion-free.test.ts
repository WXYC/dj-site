import { describe, it, expect } from "vitest";
import { walkImportGraph } from "./import-graph";

/**
 * EntryRow.tsx exists so a motion-free surface can render the live row's
 * `<tr>` presentation without pulling `motion/react` or any live-show hook
 * or API module into its bundle. A later edit that reaches for one of those
 * from inside EntryRow.tsx -- even transitively, even via a dynamic
 * `import()` this walk can't resolve a destination for -- silently reopens
 * that bundle, so the walk fails closed on anything it can't prove static
 * and clean: a banned import, a dynamic import it can't resolve, or a local
 * import (`@/...` or relative) that resolves to no file at all.
 */

const ENTRY_FILE = "src/components/experiences/modern/flowsheet/Entries/EntryRow.tsx";

// Local modules EntryRow.tsx's module graph may never reach, named however a
// specifier might spell them (the `@/` alias, a relative path, baseUrl's bare
// form, or with an explicit extension) -- matched by resolved file, not text.
const BANNED_LOCAL_SPECIFIERS = [
  "@/src/hooks/flowsheetHooks",
  "@/src/hooks/authenticationHooks",
  "@/lib/features/bin/api",
  "@/lib/features/lml/api",
];

// Motion's own package entry points, plus the two packages that hold its
// engine and are directly importable rather than reachable only as a
// subpath of motion/framer-motion. Banning a package root also bans every
// subpath under it (motion/react, motion/react-client, motion/react-m,
// motion/react-mini, motion-dom/..., motion-utils/..., ...), so these four
// roots cover every way EntryRow.tsx could reopen the motion bundle.
const BANNED_PACKAGE_SPECIFIERS = ["motion", "framer-motion", "motion-dom", "motion-utils"];

describe("EntryRow module graph (motion-free contract)", () => {
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
    // empty too, so this also proves it actually visited EntryRow's own
    // local imports rather than nothing at all.
    expect(files).toContain(ENTRY_FILE);
    expect(files).toContain("lib/features/flowsheet/types.ts");
    expect(files).toContain("lib/features/schedule-week/showUrl.ts");
  });
});
