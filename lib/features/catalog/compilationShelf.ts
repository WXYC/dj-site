import type { ArtistByCodeOwner } from "./types";

const SMALL_NUMBERS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];

const TENS: Record<number, string> = {
  2: "twenty", 3: "thirty", 4: "forty", 5: "fifty",
  6: "sixty", 7: "seventy", 8: "eighty", 9: "ninety",
};

/**
 * The first word a leading numeral is read as, which is all the shelf letter
 * needs. Hundreds take the leading digit ("four hundred fifteen" for 415, so
 * `F`), and four digits read as a year ("nineteen fifty" for 1950, so `N`) —
 * both matching how the shelves were actually filled.
 */
function leadingNumberWord(digits: string): string | null {
  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value)) return null;
  if (value < 20) return SMALL_NUMBERS[value];
  if (value < 100) return TENS[Math.floor(value / 10)];
  if (value < 1000) return SMALL_NUMBERS[Math.floor(value / 100)];
  const yearPair = Math.floor(value / 100);
  if (yearPair >= 10 && yearPair <= 99) {
    return yearPair < 20 ? SMALL_NUMBERS[yearPair] : TENS[Math.floor(yearPair / 10)];
  }
  return SMALL_NUMBERS[Math.floor(value / 1000)] ?? null;
}

/**
 * The compilation shelf an album title alphabetizes onto, or null when the
 * title names no letter.
 *
 * Ordinary library alphabetization, which is what the shelves were filled by:
 * a leading article is not the filing word, and a leading numeral files as the
 * word it is read aloud as. Measured against every letter-subdivided
 * compilation in the catalog, the rule agrees with the librarian on 97% of
 * them; the residue is filed by subject or by a person's surname (*Best of
 * Hootenany* on H, *This is Boston not LA* on B) and no rule reaches it.
 *
 * So this is a suggestion, shown and captioned as one: it stands only until
 * the librarian says otherwise, and their pick outranks it wherever they make
 * one. What it must never be is silent — a guess nobody saw is a record
 * nobody finds.
 */
export function suggestShelfLetter(albumTitle: string): string | null {
  let remainder = albumTitle.trim();

  const article = /^(the|an|a)\s+/i.exec(remainder);
  if (article) remainder = remainder.slice(article[0].length);

  const numeral = /^(\d+)/.exec(remainder);
  if (numeral) {
    const word = leadingNumberWord(numeral[1]);
    if (word) return word[0].toUpperCase();
  }

  const firstLetter = /[a-z]/i.exec(remainder);
  return firstLetter ? firstLetter[0].toUpperCase() : null;
}

/**
 * A shelf name's subdivision letter: `Various Artists - Rock - S`,
 * `Soundtracks - K`. Anchored to the ` - <letter>` suffix so an undivided
 * bucket (`Various Artists`) never reads its own last character as one.
 */
const SHELF_LETTER_SUFFIX = /\s-\s([A-Za-z])$/;

/**
 * Which of a genre's compilation shelves an album title alphabetizes onto, as
 * an artist id, or null when the rule names no shelf the genre actually has.
 *
 * Reading the letter out of the shelf's *name* is deliberate and is confined
 * to this suggestion: the code has lost the subdivision (every shelf in a
 * genre shares `V/A` 0), and the name is the only place it survives. What the
 * match must never become is a decision made out of sight — the caller offers
 * it as a preselection the librarian reads and can change, so a wrong guess
 * costs a click rather than a misfiled record.
 */
export function findSuggestedShelfId(
  albumTitle: string,
  owners: ArtistByCodeOwner[],
): number | null {
  const letter = suggestShelfLetter(albumTitle);
  if (letter === null) return null;
  const match = owners.find((owner) => {
    const suffix = SHELF_LETTER_SUFFIX.exec(owner.artist_name);
    return suffix !== null && suffix[1].toUpperCase() === letter;
  });
  return match?.id ?? null;
}
