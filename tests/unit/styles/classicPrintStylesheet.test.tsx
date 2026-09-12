import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type Rule } from "postcss";
import type { ComponentProps } from "react";
import type { FlowsheetRangeShow } from "@wxyc/shared";
import { createComponentHarness } from "@/tests/helpers";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import ClassicShowEntries from "@/src/components/experiences/classic/schedule-week/ClassicShowEntries";

/**
 * The archived show is read on paper every morning, and classic's stylesheet is
 * a 1:1 port of tubafrenzy's `wxyc-shared.css` — except that the source's
 * `@media print` block was never carried across, which is why a three-hour show
 * that fit on one sheet now runs to four.
 *
 * These pin the port. The values come from tubafrenzy
 * (`libs/core/src/main/resources/META-INF/resources/css/wxyc-shared.css`), so a
 * drift here is a drift from the page Bill has printed for twenty years.
 *
 * The selector check is the one with teeth. Tubafrenzy's rule targets
 * `.entry-table`, a class dj-site does not have — copying it verbatim would
 * land a print block that parses, lints, reviews clean, and silently styles
 * nothing. So the rules are matched against the DOM the archived show actually
 * renders rather than read as text.
 */

const CLASSIC_CSS = resolve(__dirname, "../../../src/styles/classic/wxyc.css");

// Tubafrenzy's own print values.
const TUBAFRENZY_PRINT_BODY_FONT_SIZE = "9pt";
const TUBAFRENZY_PRINT_CELL_PADDING = "2px 4px";
// The class the Time cells carry, so print can drop the column by name rather
// than by position — a :first-child rule would silently retarget if a column
// were ever added to the left of it.
const TIME_CELL_CLASS = "classic-schedule-week-time";

const show = {
  id: 1951179,
  show_name: null,
  dj_name: "DJ Chowder",
  start_time: "2026-08-22T20:36:00.000Z",
  end_time: "2026-08-23T00:01:00.000Z",
} as FlowsheetRangeShow;

const entry = (id: number): FlowsheetRangeEntryWire =>
  ({
    id,
    play_order: id,
    show_id: show.id,
    add_time: "2026-08-22T21:00:00.000Z",
    entry_type: "track",
    request_flag: false,
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
  }) as FlowsheetRangeEntryWire;

const setup = createComponentHarness<ComponentProps<typeof ClassicShowEntries>>(
  ClassicShowEntries,
  {
    show,
    entries: [],
    isPartial: false,
    partialEdge: null,
    isLoading: false,
  }
);

const printRules = (): Rule[] => {
  const root = postcss.parse(readFileSync(CLASSIC_CSS, "utf8"));
  const rules: Rule[] = [];
  root.walkAtRules("media", (atRule) => {
    if (!/(^|[^-\w])print([^-\w]|$)/.test(atRule.params)) return;
    atRule.walkRules((rule) => {
      rules.push(rule);
    });
  });
  return rules;
};

const declaration = (rules: Rule[], property: string) => {
  for (const rule of rules) {
    for (const node of rule.nodes ?? []) {
      if (node.type === "decl" && node.prop === property) {
        return { selector: rule.selector, value: node.value };
      }
    }
  }
  return null;
};

describe("classic print stylesheet", () => {
  beforeAll(() => {
    // Classic's rules are scoped under this attribute, which the app sets on
    // <html>. Without it here, a correctly-scoped selector would match nothing
    // and the applicability checks below would fail for the wrong reason.
    document.documentElement.setAttribute("data-experience", "classic");
  });

  it("declares a print block at all", () => {
    expect(printRules().length).toBeGreaterThan(0);
  });

  it("hides the navigation bar, which is chrome no printout wants", () => {
    const hidden = printRules().filter((rule) =>
      (rule.nodes ?? []).some(
        (node) => node.type === "decl" && node.prop === "display" && node.value === "none"
      )
    );
    expect(hidden.map((rule) => rule.selector).join(" ")).toContain(".nav-bar");
  });

  it("sets tubafrenzy's 9pt body size", () => {
    const found = declaration(printRules(), "font-size");
    expect(found?.value).toBe(TUBAFRENZY_PRINT_BODY_FONT_SIZE);
  });

  it("tightens cell padding to tubafrenzy's value", () => {
    const found = declaration(printRules(), "padding");
    expect(found?.value.replace(/\s*!important$/, "")).toBe(
      TUBAFRENZY_PRINT_CELL_PADDING
    );
  });

  it("drops the Time column, which the page this ports never had", () => {
    // `flowsheetRadioShowDisplayPublic.jsp` lays out five columns — an unlabeled
    // capsule gutter, Artist, Song, Release, Label — and no time. dj-site added
    // a sixth, and at paper width the six cannot fit on one line, so every row
    // wraps to two. That is the "whole thing is triple spaced" being reported:
    // a regression against the printed page, not a preference about timestamps.
    // Screen keeps the column; only the printout returns to five.
    const { container } = setup({ entries: [entry(1)] });
    expect(container.querySelectorAll(`.${TIME_CELL_CLASS}`).length).toBeGreaterThan(0);

    const hiddenSelectors = printRules()
      .filter((rule) =>
        (rule.nodes ?? []).some(
          (node) => node.type === "decl" && node.prop === "display" && node.value === "none"
        )
      )
      .map((rule) => rule.selector)
      .join(" ");
    expect(hiddenSelectors).toContain(TIME_CELL_CLASS);
  });

  it("aims every print rule at markup the archived show actually renders", () => {
    const { container } = setup({ entries: [entry(1), entry(2), entry(3)] });

    // The nav is a sibling surface, not part of this component; its own tests
    // pin the class. Everything else must hit something here, or it is a
    // selector ported from a page whose markup dj-site does not share.
    const aimedAtEntries = printRules()
      .map((rule) => rule.selector)
      .filter((selector) => !selector.includes(".nav-bar"))
      // Document-scaffolding rules (the body size, the dark-scheme reset) target
      // elements that sit above this component's root by construction, so they
      // are exempt from the applicability check rather than failing it.
      .filter((selector) => !/\bbody\b/.test(selector) && !/^html\S*$/.test(selector.trim()));

    expect(aimedAtEntries.length).toBeGreaterThan(0);
    for (const selector of aimedAtEntries) {
      // Queried from `document`, not `container`: these selectors are scoped
      // under `html[data-experience="classic"]`, and jsdom's element-scoped
      // querySelectorAll does not resolve the ancestor half of a selector the
      // way the spec (and every browser) does — it would report zero matches
      // for a selector that works perfectly in the app.
      expect(
        document.querySelectorAll(selector).length,
        `no element matches print selector: ${selector}`
      ).toBeGreaterThan(0);
    }
    expect(container).toBeTruthy();
  });
});
