// Renders nothing when no album card is open, so parallel-route resolution
// doesn't 404 on unmatched segments in the @information slot (WXYC/dj-site#979).
// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export default function Default() {
  return null;
}
