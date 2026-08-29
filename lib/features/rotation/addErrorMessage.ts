/**
 * The message to show an MD when `POST /library/rotation` (the free-text
 * add) is refused.
 *
 * Mirrors `flowsheetWriteErrorMessage`'s shape-unwrapping, kept as its own
 * copy rather than a shared import: the two live in different features and
 * their fallback copy is feature-specific ("add rotation release" vs "add to
 * flowsheet"). Backend-Service's `addRotation` controller (the free-text
 * relaxation of `POST /library/rotation` for a release with no catalogued
 * album) reports every refusal -- a missing `rotation_bin`, a missing
 * artist/title pair, a snapshot field over the 128-character limit -- as a
 * `WxycError`, which serializes to `{ message }`. That string is precise
 * enough to act on and is rendered inline (see `RotationReleaseInsert`'s
 * `validationMessage`, matching the JSP's own div of the same name), so this
 * only falls back to a generic sentence for shapes that carry no such
 * message at all.
 */
export function rotationAddErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "data" in err &&
    err.data &&
    typeof err.data === "object" &&
    "message" in err.data &&
    typeof (err.data as { message: unknown }).message === "string"
  ) {
    return (err.data as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Failed to add rotation release.";
}
