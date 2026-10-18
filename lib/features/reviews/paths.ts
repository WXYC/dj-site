import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import { STAGES, type Stage } from "./myReviews";

/**
 * Source of a RegExp matching the pathnames on which the Reviews sidebar entry is current: the review screens and a record's intake page and slip. A string, not a function, so the server-rendered Leftbar can pass it to the client LeftbarLink.
 */
export const REVIEWS_ACTIVE_PATTERN =
  "^/dashboard/(reviews(/.*)?|admin/intake/[^/]+(/slip)?)$";

/** Where the review editor was opened from: one of a fixed set, never a URL, so the editor's back link can't be pointed elsewhere. `record` carries the intake item's id. */
export type EditorOrigin = { from: "mine"; stage?: Stage } | { from: "shelf" } | { from: "record"; record: number } | null;

/** Reads the editor's `from`, `stage` and `record` query values; anything outside the fixed set is no origin. */
export function parseEditorOrigin(params: { from?: string; stage?: string; record?: string }): EditorOrigin {
  if (params.from === "mine") {
    const stage = STAGES.find((s) => s === params.stage);
    return stage ? { from: "mine", stage } : { from: "mine" };
  }
  if (params.from === "shelf") {
    return { from: "shelf" };
  }
  if (params.from === "record" && /^[1-9]\d*$/.test(params.record ?? "")) {
    return { from: "record", record: Number(params.record) };
  }
  return null;
}

/** The editor's address for a review, carrying where it is opened from. `extra` adds query values such as `arrived`. */
export function editorHref(reviewId: number, origin: EditorOrigin, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...origin, ...extra })) {
    if (v !== undefined) {
      query.set(k, String(v));
    }
  }
  const search = query.toString();
  return `/dashboard/reviews/${reviewId}${search ? `?${search}` : ""}`;
}

/** The editor's back link: to the place it was opened from, or the review shelf. */
export function editorBack(origin: EditorOrigin): { href: string; label: string } {
  switch (origin?.from) {
    case "mine":
      return { href: `/dashboard/reviews/mine${origin.stage ? `?stage=${origin.stage}` : ""}`, label: REVIEW_COPY.editorBack.myReviews };
    case "record":
      return { href: `/dashboard/admin/intake/${origin.record}`, label: REVIEW_COPY.editorBack.record };
    default:
      return { href: "/dashboard/reviews", label: REVIEW_COPY.editorBack.shelf };
  }
}
