const COLLAPSE_MS = 500;

/**
 * Shows a row moving to a tab: a decorative copy of its cover flies to the tab's count pill (or the tab, when it has none) while the row closes up. It resolves once both have finished, or one is cancelled: the write has already succeeded, so a failed animation must not read as a failed write. The caller runs it only after the write has succeeded.
 *
 * It does nothing under reduced motion, or where the browser has no Web Animations API, so the caller can await it either way. The copy is removed in every case. The row stays collapsed (`fill: forwards`) until the list's reload removes it, but that reload starts with the write and may remove the row before the collapse ends, so the motion can be cut short; a row that has left the page settles the animation, and nothing here depends on it.
 */
export async function moveRowToTab(row: HTMLElement, tabPath: string): Promise<void> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof row.animate !== "function") {
    return;
  }
  const item = row.closest("li") ?? row;
  const cover = row.querySelector<HTMLElement>("img") ?? row.querySelector<HTMLElement>("[aria-hidden='true']");
  const target = document.querySelector(`[data-tab-count='${tabPath}']`) ?? document.querySelector(`[data-tab='${tabPath}']`);
  const clone = cover && target ? (cover.cloneNode(true) as HTMLElement) : null;
  try {
    const finished: Promise<unknown>[] = [];
    if (clone && cover && target) {
      const from = cover.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      clone.setAttribute("aria-hidden", "true");
      Object.assign(clone.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: "0", pointerEvents: "none", zIndex: "1500" });
      document.body.appendChild(clone);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      finished.push(
        clone.animate(
          [{ transform: "translate(0, 0) scale(1)", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.4 }],
          { duration: COLLAPSE_MS, easing: "ease-in", fill: "forwards" },
        ).finished,
      );
    }
    const height = item.getBoundingClientRect().height;
    item.style.overflow = "hidden";
    // A list item keeps a minimum height and its padding, which `height` alone does not get under: they go to zero too, or the row stops short of closing.
    const closed = { minHeight: "0px", minBlockSize: "0px", paddingTop: "0px", paddingBottom: "0px" };
    finished.push(item.animate({ height: [`${height}px`, "0px"], ...closed, opacity: [1, 0] }, { duration: COLLAPSE_MS, fill: "forwards" }).finished);
    await Promise.all(finished);
  } catch {
    // Cancelled by the browser, or by the row leaving the page; the row's removal does not depend on it.
  } finally {
    clone?.remove();
  }
}
