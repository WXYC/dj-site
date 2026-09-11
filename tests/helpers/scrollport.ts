/**
 * Backs `scrollTop` with a real per-element value for the life of one spec.
 *
 * jsdom has no layout, so `scrollTop` reads 0 whatever is written to it and
 * bottom-detection arithmetic has nothing to work with. Installing this on the
 * prototype rather than on one element is what lets a spec observe an offset
 * written during a component's own mount, before the spec can reach the node.
 *
 * What it pins is plumbing — that an offset is recorded and written back. That
 * a browser then honours the write against a real scrollport is a layout claim,
 * and belongs in Playwright.
 */
export function installScrollTopShim(): () => void {
  const offsets = new WeakMap<HTMLElement, number>();
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollTop",
  );

  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get(this: HTMLElement) {
      return offsets.get(this) ?? 0;
    },
    set(this: HTMLElement, value: number) {
      offsets.set(this, value);
    },
  });

  return () => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, "scrollTop", original);
    }
  };
}

/** Gives an element a box tall enough to scroll, and parks it at `scrollTop`. */
export function makeScrollable(
  element: HTMLElement,
  { scrollTop = 0, scrollHeight = 2000, clientHeight = 500 } = {},
): void {
  Object.defineProperty(element, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
  Object.defineProperty(element, "clientHeight", {
    value: clientHeight,
    configurable: true,
  });
  element.scrollTop = scrollTop;
}
