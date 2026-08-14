"use client";

import { useId, useState } from "react";
import { useGetGenresQuery } from "@/lib/features/catalog/api";
import {
  isRockCompLettersRequired,
  validateArtistSearchForm,
  type CallLetterMode,
} from "@/lib/features/catalog/chooserValidation";

/**
 * Reproduces `chooseLibraryCodeOrArtist.jsp`'s `artistSearchForm`: genre
 * select, the textbox-vs-compilation call-letter mode radios, and the
 * Rock/Soundtracks-only `rockCompLetters` sub-bucket field, validated to the
 * JSP's exact client-side rules (`library-code-form.js`).
 *
 * Divergence from the JSP, forced by the Backend contract: the JSP submits
 * `mode=findOrCreateLibraryCode` to a legacy endpoint that resolves a code to
 * an existing artist, a new-artist form, or `multipleArtistsDisplay.jsp` for
 * a multi-match. Backend-Service has no such resolve endpoint, so this form
 * validates and stops there rather than inventing a client-side scan or
 * approximating it with the unrelated name-search endpoint.
 */
export default function ArtistSearchForm() {
  const genreFieldId = useId();
  const lettersId = useId();
  const numbersId = useId();
  const rockCompLettersId = useId();

  const { data: genres } = useGetGenresQuery();

  const [genreId, setGenreId] = useState<number | null>(null);
  const [callLetterMode, setCallLetterMode] = useState<CallLetterMode>(null);
  const [artistLettersTextbox, setArtistLettersTextbox] = useState("");
  const [artistNumbersTextbox, setArtistNumbersTextbox] = useState("");
  const [rockCompLetters, setRockCompLetters] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [deferredNote, setDeferredNote] = useState(false);

  const showRockCompLetters =
    callLetterMode === "compilation" && isRockCompLettersRequired(genreId);

  const reset = () => {
    setCallLetterMode(null);
    setArtistLettersTextbox("");
    setArtistNumbersTextbox("");
    setRockCompLetters("");
    setValidationMessage(null);
    setDeferredNote(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDeferredNote(false);

    const result = validateArtistSearchForm({
      callLetterMode,
      artistLettersTextbox,
      rockCompLetters,
      genreId,
    });

    if (!result.valid) {
      setValidationMessage(result.message);
      return;
    }

    setValidationMessage(null);
    setDeferredNote(true);
  };

  return (
    <form name="artistSearchForm" onSubmit={handleSubmit}>
      <h3>
        Enter a library code below. If the code exists, you will be taken to the appropriate page.
        <br />
        If the code does not exist, you will get the chance to create it and associate it with an
        artist.
      </h3>

      <table cellPadding={5}>
        <tbody>
          <tr>
            <td style={{ textAlign: "right" }}>
              <label htmlFor={genreFieldId}>Genre:</label>
            </td>
            <td>
              <select
                id={genreFieldId}
                value={genreId ?? ""}
                onChange={(e) => setGenreId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="" disabled>
                  Select genre...
                </option>
                {(genres ?? []).map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.genre_name}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "right" }}>Call Letters/Numbers:</td>
            <td>
              <input
                type="radio"
                name="callLetterMode"
                value="textbox"
                checked={callLetterMode === "textbox"}
                onChange={() => setCallLetterMode("textbox")}
                aria-label="Call letters: mode"
              />
              Call letters:
              <input
                id={lettersId}
                type="text"
                aria-label="Call letters:"
                value={artistLettersTextbox}
                disabled={callLetterMode !== "textbox"}
                onChange={(e) => setArtistLettersTextbox(e.target.value)}
                size={2}
                maxLength={2}
              />
              &nbsp;Call Numbers:
              <input
                id={numbersId}
                type="text"
                aria-label="Call Numbers:"
                value={artistNumbersTextbox}
                disabled={callLetterMode !== "textbox"}
                onChange={(e) => setArtistNumbersTextbox(e.target.value)}
                size={3}
                maxLength={3}
              />
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "right" }} />
            <td>
              <input
                type="radio"
                name="callLetterMode"
                value="compilation"
                checked={callLetterMode === "compilation"}
                onChange={() => setCallLetterMode("compilation")}
                aria-label="Various Artists (compilations)"
              />
              Various Artists (compilations)
              {showRockCompLetters && (
                <span id="span_rockVA_letters">
                  <input
                    id={rockCompLettersId}
                    type="text"
                    aria-label="Rock comp letter"
                    value={rockCompLetters}
                    onChange={(e) => setRockCompLetters(e.target.value)}
                    size={1}
                    maxLength={1}
                  />
                  (Rock comps require a Call Letter)
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "right" }} />
            <td />
          </tr>
          <tr>
            <td />
            <td>
              <div
                id="validationMessage"
                className={`validation-message${validationMessage ? " visible" : ""}`}
                role={validationMessage ? "alert" : undefined}
              >
                {validationMessage}
              </div>
              {deferredNote && (
                <div role="status">
                  Code lookup is not yet available — resolving a code to an existing artist
                  requires Backend-Service support that is not deployed yet.
                </div>
              )}
            </td>
          </tr>
          <tr>
            <td />
            <td>
              <input type="submit" value="Search!" />
              &nbsp;&nbsp;&nbsp;&nbsp;
              <input type="button" value="Reset values" onClick={reset} />
            </td>
          </tr>
        </tbody>
      </table>
    </form>
  );
}
