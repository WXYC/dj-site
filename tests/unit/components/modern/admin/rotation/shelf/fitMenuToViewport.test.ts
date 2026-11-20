import { describe, expect, it } from "vitest";
import {
  MENU_MIN_ROOM_PX,
  MENU_VIEWPORT_MARGIN_PX,
  menuRoomPx,
} from "@/src/components/experiences/modern/admin/rotation/shelf/fitMenuToViewport";

const VIEWPORT = 800;
const GAP = 4;

describe("menuRoomPx", () => {
  it.each([
    { placement: "bottom-start", anchor: { top: 500, bottom: 520 }, expected: VIEWPORT - 520 - GAP - MENU_VIEWPORT_MARGIN_PX },
    { placement: "bottom", anchor: { top: 100, bottom: 120 }, expected: VIEWPORT - 120 - GAP - MENU_VIEWPORT_MARGIN_PX },
    { placement: "top-start", anchor: { top: 500, bottom: 520 }, expected: 500 - GAP - MENU_VIEWPORT_MARGIN_PX },
    { placement: "top", anchor: { top: 300, bottom: 320 }, expected: 300 - GAP - MENU_VIEWPORT_MARGIN_PX },
  ])("leaves the room between the anchor and the edge a $placement menu opens toward", ({ placement, anchor, expected }) => {
    expect(menuRoomPx(placement, anchor, VIEWPORT, GAP)).toBe(expected);
  });

  it.each([
    { placement: "bottom-start", anchor: { top: 780, bottom: 798 } },
    { placement: "top-start", anchor: { top: 2, bottom: 20 } },
  ])("never shrinks a $placement menu below a usable floor at the viewport edge", ({ placement, anchor }) => {
    expect(menuRoomPx(placement, anchor, VIEWPORT, GAP)).toBe(MENU_MIN_ROOM_PX);
  });
});
