/** The fade that marks a record the DJ was just sent to: a warm background that clears over three seconds. It is a change of colour, not movement, so it stays under reduced motion. */
export const ADDED_FLASH_SX = {
  animation: "recordAddedFade 3s ease-out",
  "@keyframes recordAddedFade": { from: { backgroundColor: "var(--joy-palette-warning-softBg)" } },
} as const;

/** Brings a just-marked row into view, since it can be off screen. Smooth scrolling gives way to a jump under reduced motion. */
export function bringMarkedIntoView(el: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
}
