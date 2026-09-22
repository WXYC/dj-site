import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sourceFiles } from "@/tests/helpers/source-files";

// The full-viewport background image loads on every dashboard + login cold
// load. It was a 2.9 MB PNG (`wxyc_color.png`) + a 650 KB JPEG (`wxyc_dark.jpg`)
// that, on a throttled connection, became the LCP element (~18.7 s). This
// contract locks in the WebP replacement: the heavy originals must be gone and
// nothing in the source tree may reference them, or the regression returns
// silently (a stray `url(".../wxyc_color.png")` re-ships 2.9 MB).
const IMG_DIR = join(process.cwd(), "public", "img");
// lib/ is a first-class source root here (lib/features/*, middleware helpers),
// so a stray reference there must fail the guard too, not just src/ and app/.
const SCAN_ROOTS = ["src", "app", "lib"];
const SOURCE_EXTENSIONS = /\.(tsx?|jsx?|mjs|cjs|css|scss)$/;
const RETIRED = ["/img/wxyc_color.png", "/img/wxyc_dark.jpg"];


describe("background image assets (cold-load contract)", () => {
  it("ships the optimized WebP backgrounds", () => {
    expect(existsSync(join(IMG_DIR, "wxyc_color.webp"))).toBe(true);
    expect(existsSync(join(IMG_DIR, "wxyc_dark.webp"))).toBe(true);
  });

  it("no longer ships the heavy PNG/JPEG originals", () => {
    expect(existsSync(join(IMG_DIR, "wxyc_color.png"))).toBe(false);
    expect(existsSync(join(IMG_DIR, "wxyc_dark.jpg"))).toBe(false);
  });

  it("keeps the WebP backgrounds within a cold-load byte budget", () => {
    // WebP q80 measured at 59 KB / 300 KB; guard well above to catch a
    // future re-export that balloons the asset, without being brittle.
    expect(statSync(join(IMG_DIR, "wxyc_color.webp")).size).toBeLessThan(200 * 1024);
    expect(statSync(join(IMG_DIR, "wxyc_dark.webp")).size).toBeLessThan(500 * 1024);
  });

  it("has no source reference to the retired originals", () => {
    const offenders = sourceFiles(SCAN_ROOTS, SOURCE_EXTENSIONS).filter((file) =>
      RETIRED.some((p) => readFileSync(file, "utf8").includes(p)),
    );
    expect(offenders).toEqual([]);
  });
});
