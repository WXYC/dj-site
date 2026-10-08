import { isRefusal } from "@/lib/rtk-endpoint-error";

/**
 * The station-approved line for a `POST /library` import the backend refused
 * with a 409 `rotation_not_eligible` or `review_required`. Deliberately not the
 * server's `message`: the refusal covers several situations (linked, moved,
 * missing, post-cutover) and this wording is true of all of them.
 */
export const ROTATION_IMPORT_REFUSED_MESSAGE =
  "This entry can't be imported here. It may already be linked to a release, it may have moved to another bin, or it may have been added after reviews moved into the DJ site. Reload the list to see where it stands now.";

/** True for the 409s `POST /library` answers a `from_rotation_id` import with, having written nothing. */
export function isRotationImportRefused(err: unknown): boolean {
  return isRefusal(err, {
    status: 409,
    reasons: ["rotation_not_eligible", "review_required"],
    key: "rotationWriteError",
  });
}
