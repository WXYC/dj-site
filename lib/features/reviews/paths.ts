/**
 * Source of a RegExp matching the pathnames on which the Reviews sidebar entry is current: the review screens and a record's intake page and slip. A string, not a function, so the server-rendered Leftbar can pass it to the client LeftbarLink.
 */
export const REVIEWS_ACTIVE_PATTERN =
  "^/dashboard/(reviews(/.*)?|admin/intake/[^/]+(/slip)?)$";
