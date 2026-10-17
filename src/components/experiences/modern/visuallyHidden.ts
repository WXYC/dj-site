/** Takes an element out of sight but leaves it in the accessibility tree, so it still names or reads as part of what it sits in. The one copy every screen uses. */
export const VISUALLY_HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
