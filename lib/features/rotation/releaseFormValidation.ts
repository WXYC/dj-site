/**
 * The rules the rotation release forms check before submitting, in the JSPs'
 * own order and their own wording. One owner for the sentences: a librarian
 * who reads one wording for a condition on the add screen and another for the
 * same condition on the editor reads them as two different problems.
 */
export const PRESENTATION_NAME_REQUIRED_MESSAGE = "Please enter a presentation name.";
export const TITLE_REQUIRED_MESSAGE = "Please enter a title.";
export const FORMAT_REQUIRED_MESSAGE = "Please select a format.";

/** `PATCH /library/rotation/:id` SETs only the keys it receives, so an empty body states nothing. */
export const NOTHING_CHANGED_MESSAGE = "Nothing on this form has changed.";

/**
 * No wire value clears the artist/title/label trio: the server validates each
 * as a non-empty string, so a blank one is a 400 rather than a cleared column.
 */
export const LABEL_NOT_CLEARABLE_MESSAGE =
  "Please enter a record label name. A record label can be corrected here, but it cannot be cleared.";

/**
 * `formatId` is `undefined` where the screen is not setting a format at all,
 * which is not the same as leaving one unchosen. Most rotation rows predate
 * the column and carry none; requiring one there would refuse a kill-date
 * correction over a field nobody touched, unanswerably so while a formats
 * outage has the select withdrawn.
 */
export function rotationReleaseRefusal(fields: {
  artistName: string;
  title: string;
  formatId?: number | null;
}): string | null {
  if (fields.artistName.trim() === "") return PRESENTATION_NAME_REQUIRED_MESSAGE;
  if (fields.title.trim() === "") return TITLE_REQUIRED_MESSAGE;
  if (fields.formatId === null) return FORMAT_REQUIRED_MESSAGE;
  return null;
}
