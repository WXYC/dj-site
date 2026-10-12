import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { CssVarsProvider, extendTheme } from "@mui/joy/styles";
import SlipPreview, { SlipFccRow } from "@/src/components/experiences/modern/reviews/SlipPreview";
import { useSlipPrint } from "@/src/components/experiences/modern/reviews/useSlipPrint";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import { renderWithProviders } from "@/tests/helpers";

const FIELDS = { buzzwords: "warm, loose", artist_blurb: "Argentine songwriter", review: "Warm and loose.", recommended_tracks: "la paradoja", fcc: null };

// The modern theme loads Kanit at 400 and 500 only and maps fontWeight.lg to 500; the slip must ask for that token.
const modernWeights = extendTheme({ fontWeight: { lg: 500 } });

const slip = (onCover?: boolean) => (
  <CssVarsProvider theme={modernWeights}>
    <SlipPreview artist="Juana Molina" album="DOGA" label="Sonamos" reviewer="Reviewer" date="10/10/26" fields={FIELDS} onCover={onCover} />
  </CssVarsProvider>
);

/** The declarations emotion generated for an element's classes, split into those that apply everywhere and those inside `@media screen`. */
const rulesOf = (...els: HTMLElement[]) => {
  const classes = els.flatMap((el) => [...el.classList].filter((c) => c.startsWith("css-")));
  const matches = (rule: CSSRule) => classes.some((c) => (rule as CSSStyleRule).selectorText?.includes(`.${c}`));
  const out = { always: "", screen: "", other: "" };
  for (const sheet of [...document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      if (rule instanceof CSSMediaRule) {
        const key = rule.conditionText === "screen" ? "screen" : "other";
        for (const inner of [...rule.cssRules]) if (matches(inner)) out[key] += inner.cssText;
      } else if (matches(rule)) {
        out.always += rule.cssText;
      }
    }
  }
  return out;
};
const slipCss = (el: HTMLElement) => rulesOf(el).always;

describe("SlipPreview", () => {
  it("is the slip's real width but never wider than its column", () => {
    renderWithProviders(slip());
    const css = slipCss(screen.getByRole("group", { name: REVIEW_COPY.slip.name }));
    expect(css).toMatch(/width:\s*4\.25in/);
    expect(css).toMatch(/max-width:\s*100%/);
  });

  it("draws its row labels at weight 500, the medium face the theme loads", () => {
    renderWithProviders(slip());
    const label = screen.getByText(REVIEW_COPY.slip.recommended);
    expect(slipCss(label)).toMatch(/font-weight:\s*500/);
  });

  // Kanit 500 sets "Recommended" 6.8em wide, so at the slip's 0.8rem it overflows the 0.82in label column by about 8px; at 0.875em of that it is about 76px.
  it("sets its row labels small enough for 'Recommended' to fit the label column, on screen and in print", () => {
    renderWithProviders(slip());
    const group = screen.getByRole("group", { name: REVIEW_COPY.slip.name });
    const { always, screen: onScreen } = rulesOf(group);
    expect(always).toMatch(/>\s*div\s*>\s*strong[^{]*\{[^}]*font-size:\s*0\.875em/);
    expect(onScreen).not.toMatch(/font-size/);
  });

  it("leaves the FCC label at its value's size when the row is drawn outside a slip", () => {
    renderWithProviders(
      <CssVarsProvider theme={modernWeights}>
        <div>
          <SlipFccRow fcc="No FCC issues" />
        </div>
      </CssVarsProvider>,
    );
    const label = screen.getByText(REVIEW_COPY.fields.fcc.label);
    expect(rulesOf(label).always).not.toMatch(/font-size/);
  });

  it("aligns each row's label and value on their first baseline", () => {
    renderWithProviders(slip());
    const row = screen.getByText(REVIEW_COPY.slip.recommended).parentElement as HTMLElement;
    expect(row.style.alignItems).toBe("baseline");
  });

  // The tape reaches about 0.1in above the slip, past the 4px gap the page leaves under the printed-version note; `&&` is what outranks that gap's rule.
  it.each([
    ["on the cover", true, /\.(css-[\w-]+)\.\1[^{]*\{[^}]*margin-top:\s*0\.12in/],
    ["not on the cover", false, null],
    ["unset", undefined, null],
  ])("clears the printed-version note on screen only for a review %s", (_name, onCover, expected) => {
    renderWithProviders(slip(onCover));
    const group = screen.getByRole("group", { name: REVIEW_COPY.slip.name });
    const { always, screen: onScreen, other } = rulesOf(group);
    if (expected) expect(onScreen).toMatch(expected);
    else expect(onScreen).not.toMatch(/margin-top/);
    expect(always + other).not.toMatch(/margin-top/);
  });

  it.each([
    ["on the cover", true, 2],
    ["not on the cover", false, 0],
    ["unset", undefined, 0],
  ])("draws tape for a review %s", (_name, onCover, tapes) => {
    renderWithProviders(slip(onCover));
    const group = screen.getByRole("group", { name: REVIEW_COPY.slip.name });
    const tape = group.querySelectorAll(":scope > [aria-hidden='true']");
    expect(tape).toHaveLength(tapes);
    tape.forEach((t) => expect(t.textContent).toBe(""));
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe(REVIEW_COPY.slip.name);
  });

  it("keeps the paper, rules, shadow and tape behind @media screen", () => {
    renderWithProviders(slip(true));
    const group = screen.getByRole("group", { name: REVIEW_COPY.slip.name });
    const tape = group.querySelector("[aria-hidden='true']") as HTMLElement;
    const { always, screen: onScreen, other } = rulesOf(group, tape);
    expect(onScreen).toMatch(/background/);
    expect(onScreen).toMatch(/box-shadow/);
    expect(onScreen).toMatch(/border-bottom/);
    expect(always + other).not.toMatch(/background|box-shadow|border-bottom/);
  });

  it("uses theme tokens, not hex colors, for the paper", () => {
    renderWithProviders(slip(true));
    const { always, screen: onScreen } = rulesOf(screen.getByRole("group", { name: REVIEW_COPY.slip.name }));
    const css = always + onScreen;
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("the print stylesheet", () => {
  const PRINT_CSS = `@media print {
  body * { visibility: hidden; }
  .review-slip-print, .review-slip-print * { visibility: visible; }
  .review-slip-print { position: absolute; left: 0; top: 0; }
}`;

  function Sheet() {
    const { sheet } = useSlipPrint();
    return <>{sheet}</>;
  }

  it("is byte-identical to the stylesheet the slip pages have always printed with", () => {
    const { container } = renderWithProviders(<Sheet />);
    expect(container.querySelector("style")?.textContent).toBe(PRINT_CSS);
  });
});
