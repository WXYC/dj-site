"use client";

import { skipToken } from "@reduxjs/toolkit/query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useGetArtistCardQuery,
  useGetGenresQuery,
  useRefileArtistMutation,
  useResolveArtistByCodeQuery,
} from "@/lib/features/catalog/api";
import {
  CODE_NUMBER_MAX,
  codeLettersTooLong,
  isCanonicalCodeLetters,
  normalizeCodeLetters,
  parseArtistCodeNumber,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import {
  interpretArtistRefileError,
  type ArtistRefileRefusal,
} from "@/lib/features/catalog/artistRefileOutcome";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import { formatArtistLibraryCode, isVariousArtists } from "@/lib/features/catalog/libraryCode";
import { resolveArtistByCodeErrorReason } from "@/lib/features/catalog/libraryCodeResolution";

const OCCUPANCY_DEBOUNCE_MS = 300;

/**
 * Re-file an artist's call letters, number and genre -- two steps,
 * like the delete screen's confirm page: Choose them (with an advisory
 * occupancy line for the destination code), then Confirm. The occupancy line is advisory only; the server's 409
 * is the authority, and its holder is named (and linked) when it lands. Every refusal is stated once here -- the
 * mutation wraps its errors so no toast doubles it.
 */
export default function ArtistRefileForm({
  artistId,
  genreId,
}: {
  artistId: number;
  genreId: number;
}) {
  const router = useRouter();
  const { data: card, isLoading } = useGetArtistCardQuery(
    { artistId, genre_id: genreId },
    // The artist may have moved genres since this entry was cached; a stale one would offer a re-file of a shelf it no longer holds.
    { refetchOnMountOrArgChange: true },
  );
  const genresQuery = useGetGenresQuery();
  // An outage must not read as "no genres": the refusal copy degrades instead of naming a partial list.
  const genres = isGenresUnavailable(genresQuery) ? undefined : genresQuery.data;
  const [refile, { isLoading: refiling }] = useRefileArtistMutation();

  // null = untouched, so the box shows the card's current number without copying it into state.
  const [text, setText] = useState<string | null>(null);
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [refusal, setRefusal] = useState<ArtistRefileRefusal | null>(null);
  const [unchanged, setUnchanged] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  // null = untouched, so the field shows the card's letters without copying them into state.
  const [lettersInput, setLettersInput] = useState<string | null>(null);
  // null = untouched: the destination genre is the card's own.
  const [genreInput, setGenreInput] = useState<number | null>(null);
  const touched = text !== null || lettersInput !== null || genreInput !== null;

  const numberText = text ?? (card ? String(card.code_artist_number) : "");
  const target = parseArtistCodeNumber(numberText);
  // The server trims and upper-cases both sides before comparing, so the stored
  // letters are normalized too. The pattern check runs on the trimmed input
  // BEFORE upper-casing, which would turn "ß" into "SS" and "ı" into "I".
  const typedLetters = (lettersInput ?? card?.code_letters ?? "").trim();
  const letters = normalizeCodeLetters(typedLetters);
  const lettersEdited = lettersInput !== null && letters !== normalizeCodeLetters((card?.code_letters ?? "").trim());
  const lettersError = !lettersEdited
    ? null
    : typedLetters === ""
      ? "Enter the call letters."
      : isVariousArtists(typedLetters)
        ? "Various Artists sections cannot be filed here."
        : codeLettersTooLong(typedLetters)
          ? "Call letters are at most 4 characters."
          : !isCanonicalCodeLetters(typedLetters)
            ? "Call letters may use only letters A-Z, digits and /."
            : null;
  const lettersChanged = lettersEdited && lettersError === null;
  const destLetters = lettersChanged ? letters : (card?.code_letters ?? "");

  const destGenreId = genreInput ?? genreId;
  const genreChanged = destGenreId !== genreId;

  const [debounced, setDebounced] = useState<{ number: number | null; letters: string; genre: number } | null>(null);
  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced({ number: target, letters: destLetters, genre: destGenreId }),
      OCCUPANCY_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [target, destLetters, destGenreId]);

  const occupancy = useResolveArtistByCodeQuery(
    card &&
      debounced?.number != null &&
      !(
        debounced.number === card.code_artist_number &&
        debounced.letters === card.code_letters &&
        debounced.genre === genreId
      )
      ? { genre_id: debounced.genre, code_letters: debounced.letters, code_number: debounced.number }
      : skipToken,
  );

  if (!card) {
    return isLoading ? (
      <div className="label" style={{ textAlign: "center" }}>
        Loading the artist...
      </div>
    ) : (
      <div data-testid="artist-refile-error" role="alert" className="artist-error-message">
        This artist could not be loaded, so its call letters, number or genre cannot be changed.
      </div>
    );
  }

  const genreName = genres?.find((genre) => genre.id === card.genre_id)?.genre_name;
  const destGenreName = genres?.find((genre) => genre.id === destGenreId)?.genre_name;
  const codeOf = (number: number, code_letters = card.code_letters, name = genreName) =>
    formatArtistLibraryCode({ genreName: name, code_letters, code_artist_number: number });
  const destCodeOf = (number: number) => codeOf(number, destLetters, destGenreName);
  const cardHref = artistCardHref(
    { id: artistId, code_letters: card.code_letters },
    { genreId },
  );
  // Without the genre word the codes read "IS 31", which names two shelves.
  const genreKnown = genreName !== undefined && destGenreName !== undefined;
  // Refused on the merits: nothing on this screen can fix it, so the action
  // goes (a retryable refusal or a conflict leaves it standing). The shared
  // letters and the two genre refusals stand because the letters or the genre
  // can be put back or changed here.
  const WITHDRAWN = {
    conflict: false,
    lettered_section: true,
    various_artists_section: true,
    not_filed_in_genre: true,
    artist_not_found: true,
    genre_not_found: false,
    letters_shared_across_genres: false,
    already_filed_in_genre: false,
    lock_unavailable: false,
    generic: false,
  } satisfies Record<ArtistRefileRefusal["reason"], boolean>;
  const withdrawn = refusal ? WITHDRAWN[refusal.reason] : false;
  const ineligible = card.code_comp_letter != null
    ? "This artist is filed in a lettered compilation section, which is filed at 0 by letter and is not re-numbered here."
    : isVariousArtists(card.code_letters)
      ? "Compilation sections are not re-filed from this screen."
      : null;
  if (ineligible) {
    return (
      <div data-testid="artist-refile-ineligible" role="alert" className="artist-error-message">
        {ineligible} <a href={cardHref}>Back to the Artist Card</a>
      </div>
    );
  }


  // Advisory line for the number the box holds now: stale (still debouncing or
  // refetching) and unreadable answers say nothing rather than guess.
  const isCurrent =
    target === card.code_artist_number && !lettersChanged && lettersError === null && !genreChanged;
  const settled =
    target !== null &&
    !isCurrent &&
    lettersError === null &&
    debounced?.number === target &&
    debounced.letters === destLetters &&
    debounced.genre === destGenreId &&
    !occupancy.isFetching;
  const owners = settled ? occupancy.currentData?.artists : undefined;
  const holder = owners?.find((owner) => owner.id !== artistId);
  // Already holding the destination code in another genre: the server refuses it as already filed there.
  const alreadyFiledThere = genreChanged && owners?.some((owner) => owner.id === artistId) === true;
  const free =
    settled &&
    (occupancy.currentData
      ? owners !== null && owners !== undefined && holder === undefined
      : resolveArtistByCodeErrorReason(occupancy.error) === "code_not_assigned");
  const conflictHolder = refusal?.reason === "conflict" ? refusal.holder : undefined;

  const submit = async () => {
    if (target === null) return;
    setRefusal(null);
    try {
      const result = await refile({
        artistId,
        code_letters: card.code_letters,
        body: {
          genre_id: genreId,
          code_artist_number: target,
          ...(lettersChanged ? { code_letters: letters } : {}),
          ...(genreChanged ? { to_genre_id: destGenreId } : {}),
        },
      }).unwrap();
      if (result.changed) setSubmitted(true);
      if (!result.changed) {
        setUnchanged(true);
        setStep("choose");
        return;
      }
      router.push(
        artistCardHref(
          // The route depends on the letters, so the result's, not the old card's.
          { id: artistId, code_letters: result.code_letters },
          {
            // The destination: the old genre-scoped URL would 404 after a move.
            genreId: result.genre_id,
            params: {
              refiled: "1",
              from: String(result.previous_code_artist_number),
              n: String(result.releases_to_relabel),
              // Raw: a legacy old code ("??") still has to say the letters changed.
              ...(result.previous_code_letters !== result.code_letters
                ? { from_letters: result.previous_code_letters }
                : {}),
              ...(result.previous_genre_id !== result.genre_id ? { from_genre: result.previous_genre_id } : {}),
            },
          },
        ),
      );
    } catch (error) {
      setRefusal(interpretArtistRefileError(error, { genres, genreId, artistName: card.artist_name }));
      setStep("choose");
    }
  };

  return (
    <div id="artistRefileCard" data-testid={`artist-refile-${step}`}>
      <h3>Change The Artist Call Letters, Number Or Genre</h3>
      <table cellPadding={5}>
        <tbody>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Artist:</b>
            </th>
            <td>{card.artist_name}</td>
          </tr>
          <tr>
            <th scope="row" style={{ textAlign: "right" }}>
              <b>Current Call Number:</b>
            </th>
            <td data-testid="artist-refile-current">{codeOf(card.code_artist_number)}</td>
          </tr>
          {step === "choose" ? (
            <>
              <tr>
                <th scope="row" style={{ textAlign: "right" }}>
                  <label htmlFor="artistRefileLetters">
                    <b>New Call Letters:</b>
                  </label>
                </th>
                <td>
                  <input
                    id="artistRefileLetters"
                    type="text"
                    maxLength={16}
                    value={lettersInput ?? card.code_letters}
                    aria-invalid={lettersError !== null}
                    onChange={(event) => {
                      setLettersInput(event.target.value);
                      setUnchanged(false);
                      setRefusal(null);
                    }}
                  />
                  {lettersError ? <div data-testid="artist-refile-letters-error">{lettersError}</div> : null}
                </td>
              </tr>
              <tr>
                <th scope="row" style={{ textAlign: "right" }}>
                  <label htmlFor="artistRefileGenre">
                    <b>New Genre:</b>
                  </label>
                </th>
                <td>
                  {genres ? (
                    <select
                      id="artistRefileGenre"
                      value={destGenreId}
                      onChange={(event) => {
                        setGenreInput(Number(event.target.value));
                        setUnchanged(false);
                        setRefusal(null);
                      }}
                    >
                      {genres.map((genre) => (
                        <option key={genre.id} value={genre.id}>
                          {genre.genre_name}
                        </option>
                      ))}
                    </select>
                  ) : isGenresUnavailable(genresQuery) ? (
                    <div data-testid="artist-refile-genres-unavailable">
                      The genre list could not be loaded, so nothing can be re-filed until it loads. Reload to try again.
                    </div>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th scope="row" style={{ textAlign: "right" }}>
                  <label htmlFor="artistRefileNumber">
                    <b>New Call Number:</b>
                  </label>
                </th>
                <td>
                  <input
                    id="artistRefileNumber"
                    type="number"
                    min={0}
                    max={CODE_NUMBER_MAX}
                    value={numberText}
                    onChange={(event) => {
                      setText(event.target.value);
                      setUnchanged(false);
                      setRefusal(null);
                    }}
                  />
                  <div data-testid="artist-refile-occupancy" role="status">
                    {isCurrent ? (
                      touched ? "That is the current call number." : null
                    ) : alreadyFiledThere ? (
                      `${card.artist_name} is already filed under ${destGenreName}.`
                    ) : holder ? (
                      <>
                        {destCodeOf(holder.code_number)} is held by{" "}
                        <a href={artistCardHref(holder, { genreId: destGenreId })}>{holder.artist_name}</a>.
                      </>
                    ) : free && target !== null ? (
                      `${destCodeOf(target)} is free.`
                    ) : null}
                  </div>
                </td>
              </tr>
              <tr>
                <td></td>
                <td>
                  {withdrawn ? null : (
                    <button
                      type="button"
                      disabled={
                        !genreKnown || target === null || isCurrent || lettersError !== null || alreadyFiledThere
                      }
                      onClick={() => setStep("confirm")}
                    >
                      Continue
                    </button>
                  )}
                  &nbsp;&nbsp;
                  <a href={cardHref}>{withdrawn ? "Back to the Artist Card" : "Cancel"}</a>
                </td>
              </tr>
            </>
          ) : (
            <tr>
              <td></td>
              <td data-testid="artist-refile-confirm-copy">
                {submitted ? (
                  "Re-filed; returning to the card…"
                ) : (
                  <>
                    Move {card.artist_name} from {codeOf(card.code_artist_number)} to{" "}
                    {destCodeOf(target ?? 0)}.{" "}
                    {genreChanged
                      ? `Its releases filed under ${genreName} move with it and re-label at once; the records will need new labels.`
                      : `Its releases filed under ${genreName} re-label at once; the records will need new labels.`}
                  </>
                )}
                <div>
                  <button type="button" onClick={submit} disabled={refiling || submitted}>
                    Re-file The Artist
                  </button>
                  &nbsp;&nbsp;
                  <button type="button" onClick={() => setStep("choose")} disabled={refiling || submitted}>
                    Back
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {refusal ? (
        <div data-testid="artist-refile-refusal" role="alert" className="artist-error-message">
          {conflictHolder ? (
            <>
              {destCodeOf(conflictHolder.code_artist_number)} is held by{" "}
              <a href={artistCardHref(conflictHolder, { genreId: destGenreId })}>{conflictHolder.artist_name}</a>.
              Nothing was changed.
            </>
          ) : refusal.reason === "conflict" && target !== null ? (
            `${destCodeOf(target)} is held by another artist. Nothing was changed.`
          ) : (
            refusal.message
          )}
        </div>
      ) : null}
      {unchanged ? (
        <div data-testid="artist-refile-unchanged" role="status">
          That is already this artist&apos;s call number. Nothing changed.
        </div>
      ) : null}
    </div>
  );
}
