/** The rules emotion generated for some elements' classes, as CSS text, grouped by the at-rule they sit in. */
export interface EmotionRules {
  /** Rules outside any at-rule. */
  base: string;
  /** Rules inside `@media`, keyed by the media condition as written, e.g. `screen`. */
  media: Record<string, string>;
  /** Rules inside `@container`, keyed by the container condition as written, e.g. `(min-width: 800px)`. */
  container: Record<string, string>;
}

/**
 * Groups the stylesheet rules that target the emotion (`css-…`) classes on the given elements by the at-rule
 * they sit in, so a test can assert both where a declaration is and where it is not. Rules for other classes
 * are left out.
 *
 * Pin a plain declaration with `getComputedStyle` or `toHaveStyle` on the rendered element instead: that also
 * proves the selector reaches it. Reach for `rulesOf` only for a declaration inside `@media` or `@container`,
 * which jsdom does not apply, and assert it is in the group it belongs to and absent from `base`.
 */
export const rulesOf = (...els: Element[]): EmotionRules => {
  const classes = els.flatMap((el) => [...el.classList].filter((c) => c.startsWith("css-")));
  const targets = (rule: CSSRule) =>
    classes.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test((rule as CSSStyleRule).selectorText ?? ""));
  const out: EmotionRules = { base: "", media: {}, container: {} };
  const collect = (into: Record<string, string>, rule: CSSMediaRule | CSSContainerRule) => {
    const hits = [...rule.cssRules].filter(targets).map((r) => r.cssText);
    if (hits.length) into[rule.conditionText] = (into[rule.conditionText] ?? "") + hits.join("\n");
  };
  for (const sheet of [...document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      if (rule instanceof CSSMediaRule) collect(out.media, rule);
      else if (rule instanceof CSSContainerRule) collect(out.container, rule);
      else if (targets(rule)) out.base += (out.base ? "\n" : "") + rule.cssText;
    }
  }
  return out;
};
