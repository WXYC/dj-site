import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Minbus is the modern theme's h1-h4 title face, wired in buildTheme.ts. The
// original .otf shipped its whole 124-glyph face (~76 KB decoded) on every
// cold load even though it renders Latin text only. This contract locks in
// the woff2 subset: the heavy original must be gone and nothing in the
// source tree may reference it, or the regression returns silently (a stray
// `path: "../.../Minbus.otf"` would re-ship the unsubset face).
//
// Oxin.ttf (and its byte-identical copies under app/styles/fonts and
// src/styles/fonts) were never wired into any theme or CSS -- dead weight
// from the pre-refactor font setup -- so they are retired outright rather
// than subset.
const FONTS_DIR = join(process.cwd(), "public", "fonts");
const SCAN_ROOTS = ["src", "app", "lib"];
const RETIRED = ["fonts/Minbus.otf", "fonts/Oxin.ttf", "fonts/Oxin-g0oR.ttf"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(tsx?|jsx?|mjs|cjs|css|scss)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("font assets (cold-load contract)", () => {
  it("ships the subsetted woff2 title face", () => {
    expect(existsSync(join(FONTS_DIR, "Minbus.woff2"))).toBe(true);
  });

  it("no longer ships the unsubset original or the unused Oxin face", () => {
    expect(existsSync(join(FONTS_DIR, "Minbus.otf"))).toBe(false);
    expect(existsSync(join(FONTS_DIR, "Oxin.ttf"))).toBe(false);
  });

  it("keeps the woff2 title face within a cold-load byte budget", () => {
    // Measured at ~12 KB (down from ~76 KB decoded); guard well above to
    // catch a future re-export that balloons the subset, without being brittle.
    expect(statSync(join(FONTS_DIR, "Minbus.woff2")).size).toBeLessThan(30 * 1024);
  });

  it("has no source reference to the retired originals", () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      const abs = join(process.cwd(), root);
      if (!existsSync(abs)) continue;
      for (const file of sourceFiles(abs)) {
        const text = readFileSync(file, "utf8");
        if (RETIRED.some((p) => text.includes(p))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
