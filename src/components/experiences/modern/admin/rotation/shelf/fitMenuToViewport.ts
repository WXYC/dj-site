import type { Modifier } from "@popperjs/core";

/** Space kept between a capped menu and the viewport edge. */
export const MENU_VIEWPORT_MARGIN_PX = 8;
/** A menu jammed against the edge still shows a few items and scrolls rather than collapsing. */
export const MENU_MIN_ROOM_PX = 160;

/**
 * Height available to a menu between its anchor and the viewport edge it
 * opens toward. Popper only moves a menu (offset, flip); it never resizes one,
 * so a menu taller than that room runs off-screen with no way to reach the
 * items past the edge.
 */
export function menuRoomPx(
  placement: string,
  anchor: { top: number; bottom: number },
  viewportHeight: number,
  gap: number,
): number {
  const room = placement.startsWith("top")
    ? anchor.top - gap - MENU_VIEWPORT_MARGIN_PX
    : viewportHeight - anchor.bottom - gap - MENU_VIEWPORT_MARGIN_PX;
  return Math.max(room, MENU_MIN_ROOM_PX);
}

/**
 * Popper modifier that caps the popper's height at `menuRoomPx` for the
 * placement flip settled on. The menu inside takes `maxHeight: "inherit"` and
 * scrolls. Runs after `computeStyles` so its `maxHeight` lands in the same
 * style write as the position.
 */
export function fitMenuToViewport(gap: number): Partial<Modifier<"fitMenuToViewport", object>> {
  return {
    name: "fitMenuToViewport",
    enabled: true,
    phase: "beforeWrite",
    requires: ["computeStyles"],
    fn: ({ state }) => {
      const rect = state.elements.reference.getBoundingClientRect();
      state.styles.popper.maxHeight = `${menuRoomPx(state.placement, rect, window.innerHeight, gap)}px`;
    },
  };
}
