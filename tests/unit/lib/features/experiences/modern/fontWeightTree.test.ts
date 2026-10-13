import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODERN_DIR = path.resolve(process.cwd(), "src/components/experiences/modern");

// The modern theme loads Kanit at 400 and 500 only, so any other explicit weight
// renders a synthesized bold. Each exemption states why its request is safe.
const EXEMPT: Record<string, string> = {
  // Joy's xl is 500 in the modern theme.
  "catalog/Results/RotationLocationPill.tsx": "xl",
  // Sort-column emphasis has no 400/500 equivalent that still reads as emphasis.
  "catalog/Results/Result.tsx": "bold",
  // Renders Discogs bold markup, which is meant to be bold.
  "catalog/album/DiscogsMarkupRenderer.tsx": "<strong",
  // The review slip's own labels are scoped to their own ticket.
  "reviews/": "any",
};

const UNLOADED_WEIGHT =
  /fontWeight\s*[:=]\s*\{?\s*(?:[^,}\n]*\?\s*)?["']?(?:600|700|bold|xl)\b|<strong\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("modern components' explicit font weights", () => {
  it("asks for no unloaded weight outside the exemption list", () => {
    const offenders = sourceFiles(MODERN_DIR)
      .map((file) => path.relative(MODERN_DIR, file))
      .filter((rel) => !Object.keys(EXEMPT).some((ex) => rel.startsWith(ex)))
      .filter((rel) =>
        UNLOADED_WEIGHT.test(readFileSync(path.join(MODERN_DIR, rel), "utf8"))
      );

    expect(offenders).toEqual([]);
  });
});
