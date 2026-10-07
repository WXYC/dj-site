"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useGetArtistCardQuery,
  useGetGenresQuery,
  useRefileArtistMutation,
} from "@/lib/features/catalog/api";
import { CODE_NUMBER_MAX, parseArtistCodeNumber } from "@/lib/features/catalog/adminCreateArtistValidation";
import { artistCardHref } from "@/lib/features/catalog/artistCardRoute";
import {
  interpretArtistRefileError,
  type ArtistRefileRefusal,
} from "@/lib/features/catalog/artistRefileOutcome";
import { formatArtistLibraryCode, isVariousArtists } from "@/lib/features/catalog/libraryCode";

/**
 * Re-file an artist's call number on one genre shelf -- two steps, like the
 * delete screen's confirm page: Choose the number, then Confirm. The server's
 * 409 is the authority on whether a number is taken, and its holder is named
 * (and linked) when it lands. Every refusal is stated once here -- the
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
  const { data: card, isLoading } = useGetArtistCardQuery({ artistId, genre_id: genreId });
  const { data: genres } = useGetGenresQuery();
  const [refile, { isLoading: refiling }] = useRefileArtistMutation();

  const [text, setText] = useState("");
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [refusal, setRefusal] = useState<ArtistRefileRefusal | null>(null);
  const [unchanged, setUnchanged] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  const target = parseArtistCodeNumber(text);

  if (!card) {
    return isLoading ? (
      <div className="label" style={{ textAlign: "center" }}>
        Loading the artist...
      </div>
    ) : (
      <div data-testid="artist-refile-error" role="alert" className="artist-error-message">
        This artist could not be loaded, so its call number cannot be changed.
      </div>
    );
  }

  const genreName = genres?.find((genre) => genre.id === card.genre_id)?.genre_name;
  const codeOf = (number: number) =>
    formatArtistLibraryCode({ genreName, code_letters: card.code_letters, code_artist_number: number });
  const cardHref = artistCardHref(
    { id: artistId, code_letters: card.code_letters },
    { genreId },
  );
  // Without the genre word the codes read "IS 31", which names two shelves.
  const genreKnown = genreName !== undefined;
  // Refused on the merits: nothing on this screen can fix it, so the action
  // goes (a retryable refusal or a conflict leaves it standing).
  const withdrawn =
    refusal?.reason === "lettered_section" ||
    refusal?.reason === "not_filed_in_genre" ||
    refusal?.reason === "artist_not_found";
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

  const conflictHolder = refusal?.reason === "conflict" ? refusal.holder : undefined;

  const submit = async () => {
    if (target === null) return;
    setRefusal(null);
    try {
      const result = await refile({
        artistId,
        code_letters: card.code_letters,
        body: { genre_id: genreId, code_artist_number: target },
      }).unwrap();
      if (result.changed) setSubmitted(true);
      if (!result.changed) {
        setUnchanged(true);
        setStep("choose");
        return;
      }
      router.push(
        artistCardHref(
          { id: artistId, code_letters: card.code_letters },
          {
            genreId,
            params: {
              refiled: "1",
              from: String(result.previous_code_artist_number),
              n: String(result.releases_to_relabel),
            },
          },
        ),
      );
    } catch (error) {
      setRefusal(interpretArtistRefileError(error));
      setStep("choose");
    }
  };

  return (
    <div id="artistRefileCard" data-testid={`artist-refile-${step}`}>
      <h3>Change The Artist Call Number</h3>
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
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      setUnchanged(false);
                      setRefusal(null);
                    }}
                  />
                </td>
              </tr>
              <tr>
                <td></td>
                <td>
                  {withdrawn ? null : (
                    <button
                      type="button"
                      disabled={
                        !genreKnown || target === null || target === card.code_artist_number
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
                    {codeOf(target ?? 0)}. Every release under this shelf re-labels at once; the
                    records on the shelf will need new labels.
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
              That number is held by{" "}
              <a href={artistCardHref(conflictHolder, { genreId })}>{conflictHolder.artist_name}</a>.
              Nothing was changed.
            </>
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
