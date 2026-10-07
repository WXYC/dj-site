import { CODE_NUMBER_MAX, parseRequiredNonNegativeInt } from "./adminCreateArtistValidation";

/** What a re-file carries onto the artist card it lands on: the old number and the relabel count. */
export type RefiledParams = { from: number; releases: number };

const readable = (raw: string | undefined): number | null => {
  const parsed = raw === undefined ? null : parseRequiredNonNegativeInt(raw);
  return parsed !== null && parsed <= CODE_NUMBER_MAX ? parsed : null;
};

/**
 * Reads the `refiled` / `from` / `n` triple off a card URL, or `undefined`
 * when the landing was not a re-file or any part is malformed. Numbers only
 * cross the URL, never text: the banner sentence is composed by the card from
 * its own data (the new code comes from the refetched card, never the URL).
 */
export function parseRefiledParams(
  refiled: string | undefined,
  from: string | undefined,
  n: string | undefined,
): RefiledParams | undefined {
  if (refiled !== "1") return undefined;
  const fromNumber = readable(from);
  const releases = readable(n);
  return fromNumber === null || releases === null ? undefined : { from: fromNumber, releases };
}
