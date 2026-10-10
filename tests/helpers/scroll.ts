// jsdom's cascade does not expand the `overflow` shorthand into `overflowY`, so
// an element styled `overflow: auto` reports overflowY as `visible`. Read both.
export function scrollsVertically(element: Element): boolean {
  const { overflow, overflowY } = window.getComputedStyle(element);
  return [overflow, overflowY].some(
    (value) => value === "auto" || value === "scroll",
  );
}

export function nearestScrollableAncestor(from: Element): Element | null {
  let node: Element | null = from.parentElement;
  while (node) {
    if (scrollsVertically(node)) return node;
    node = node.parentElement;
  }
  return null;
}
