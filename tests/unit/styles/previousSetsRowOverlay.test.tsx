import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type Rule } from "postcss";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { renderWithProviders } from "@/tests/helpers";
import ResultRow from "@/src/components/experiences/classic/playlists/ResultRow";

/**
 * Each linked Previous Sets row stretches its leading-cell link over the whole
 * row with an absolutely positioned `::after`. That overlay is only safe while
 * the row is its containing block. WebKit through Safari 18 does not make a
 * relatively positioned table row a containing block, so the overlay sizes to
 * the viewport instead: every row's overlay covers the screen, the last row's
 * paints on top, and a tap anywhere — the search box included — opens the last
 * listed show. A transformed table row is a containing block in every engine.
 *
 * jsdom applies none of this stylesheet and computes no layout, so these read
 * the rules from the file and match their selectors against the row the
 * component actually renders.
 */

const PREVIOUS_SETS_CSS = resolve(__dirname, "../../../src/styles/classic/previous-sets.css");

const linkedResult: PlaylistSearchResult = {
  id: 1,
  play_date: "2024-06-15T14:30:00.000Z",
  artist_name: "Juana Molina",
  track_title: "la paradoja",
  album_title: "DOGA",
  record_label: "Sonamos",
  dj_name: "Test DJ",
  show_id: 100,
};

const declarationsFor = (rules: Rule[], element: Element): Map<string, string> => {
  const found = new Map<string, string>();
  for (const rule of rules) {
    if (!element.matches(rule.selector)) {
      continue;
    }
    rule.walkDecls((decl) => {
      found.set(decl.prop, decl.value);
    });
  }
  return found;
};

describe("classic Previous Sets row overlay", () => {
  let rules: Rule[];
  let row: HTMLTableRowElement;
  let link: HTMLAnchorElement;

  beforeAll(() => {
    rules = [];
    postcss.parse(readFileSync(PREVIOUS_SETS_CSS, "utf8")).walkRules((rule) => {
      rules.push(rule);
    });
    const { container } = renderWithProviders(
      <table>
        <tbody>
          <ResultRow result={linkedResult} />
        </tbody>
      </table>
    );
    row = container.querySelector("tr")!;
    link = row.querySelector("a")!;
  });

  it("stretches the row link over its row with an absolutely positioned overlay", () => {
    const overlay = rules.find(
      (rule) => rule.selector.endsWith("::after") && link.matches(rule.selector.replace(/::after$/, ""))
    );

    expect(overlay).toBeDefined();
    const position = overlay!.nodes.find((node) => node.type === "decl" && node.prop === "position");
    expect(position).toMatchObject({ value: "absolute" });
  });

  it("makes the linked row a containing block in every engine, not only through position", () => {
    const declarations = declarationsFor(rules, row);

    expect(declarations.get("position")).toBe("relative");
    const transform = declarations.get("transform");
    expect(transform).toBeDefined();
    expect(transform).not.toBe("none");
  });
});
