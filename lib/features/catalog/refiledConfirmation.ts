import { isCanonicalCodeLetters, parseArtistCodeNumber } from "./adminCreateArtistValidation";

/** What a re-file carries onto the artist card it lands on: the old number, the old letters when they changed, and the relabel count. */
export type RefiledParams = {
  from: number;
  releases: number;
  /** The old letters when they changed and can be shown; `null` when they changed but cannot (a legacy code); absent when they did not change. */
  fromLetters?: string | null;
};

const readable = (raw: string | undefined): number | null =>
  raw === undefined ? null : parseArtistCodeNumber(raw);

/**
 * Reads the `refiled` / `from` / `n` triple off a card URL, or `undefined`
 * when the landing was not a re-file or any part is malformed. The banner
 * sentence is composed by the card from its own data (the new code comes from
 * the refetched card, never the URL). The only text that crosses is the old
 * call letters, and only when they are canonical (`isCanonicalCodeLetters`):
 * a legacy or hand-made value is reported as `null` ("the letters changed,
 * old ones not shown"), so a link can never put free text in the station's
 * voice.
 */
export function parseRefiledParams(
  refiled: string | undefined,
  from: string | undefined,
  n: string | undefined,
  fromLetters?: string,
): RefiledParams | undefined {
  if (refiled !== "1") return undefined;
  const fromNumber = readable(from);
  const releases = readable(n);
  if (fromNumber === null || releases === null) return undefined;
  if (fromLetters === undefined) return { from: fromNumber, releases };
  return { from: fromNumber, releases, fromLetters: isCanonicalCodeLetters(fromLetters) ? fromLetters : null };
}
