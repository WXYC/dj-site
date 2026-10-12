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
 * jsdom applies no `@container` or `@media` rule, so `getComputedStyle` and `toHaveStyle` can never pin a
 * declaration such a rule sets, nor its absence: a check like `getComputedStyle(el).overflowWrap === "normal"`
 * passes whatever those rules say. Pin a plain declaration with them anyway, since that also proves the selector
 * reaches the element. Reach for `rulesOf` for a declaration inside `@media` or `@container`, and assert it is in
 * the group it belongs to and absent from `base` (and from the other groups, to pin its absence everywhere).
 *
 * Throws if a rule for these classes sits inside an at-rule nested in another at-rule (`@media` inside
 * `@container`, `@supports`, `@layer`): the groups cannot hold it, and dropping it would let an absence assertion
 * pass without looking at it.
 */
export const rulesOf = (...els: Element[]): EmotionRules => {
  const classes = els.flatMap((el) => [...el.classList].filter((c) => c.startsWith("css-")));
  const targets = (rule: CSSRule) =>
    classes.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test((rule as CSSStyleRule).selectorText ?? ""));
  const out: EmotionRules = { base: "", media: {}, container: {} };
  const isGrouping = (rule: CSSRule) => "cssRules" in rule && !("selectorText" in rule);
  const reachesTargets = (rule: CSSRule): boolean =>
    isGrouping(rule) ? [...(rule as CSSGroupingRule).cssRules].some(reachesTargets) : targets(rule);
  const collect = (into: Record<string, string>, rule: CSSMediaRule | CSSContainerRule) => {
    const nested = [...rule.cssRules].find((r) => isGrouping(r) && reachesTargets(r));
    if (nested) throw new Error(`rulesOf cannot group a rule nested inside another at-rule: ${nested.cssText}`);
    const hits = [...rule.cssRules].filter(targets).map((r) => r.cssText);
    if (hits.length) into[rule.conditionText] = (into[rule.conditionText] ?? "") + hits.join("\n");
  };
  for (const sheet of [...document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      if (rule instanceof CSSMediaRule) collect(out.media, rule);
      else if (rule instanceof CSSContainerRule) collect(out.container, rule);
      else if (isGrouping(rule) && reachesTargets(rule)) {
        throw new Error(`rulesOf cannot group a rule inside this at-rule: ${rule.cssText}`);
      } else if (targets(rule)) out.base += (out.base ? "\n" : "") + rule.cssText;
    }
  }
  return out;
};
