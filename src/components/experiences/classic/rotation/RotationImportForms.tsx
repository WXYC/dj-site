"use client";

import { useId } from "react";
import type { LibraryFormatRow, LibraryGenreRow } from "@/lib/features/catalog/types";
import { CALL_LETTERS_ADVISORY } from "@/lib/features/rotation/importSuggestions";
import RotationImportReleaseFields, {
  type ReleaseFormState,
} from "./RotationImportReleaseFields";

/** The `New Artist` half of `rotationReleaseImportNewArtist.jsp`. */
export type NewArtistFormState = {
  genreId: number | null;
  callLetters: string;
  callNumbers: string;
  presentationName: string;
  alphabeticalName: string;
};

function ValidationMessage({ message }: { message: string | null }) {
  // Always in the DOM, empty until there is something to say: adding
  // role="alert" at the same moment the text appears is announced
  // unreliably, since the region has to exist before its content changes.
  return (
    <div className={`validation-message${message ? " visible" : ""}`} role="alert">
      {message}
    </div>
  );
}

/**
 * `rotationReleaseImport.jsp`'s artist-selected branch: the release form for
 * an artist that is already in the library.
 *
 * The JSP prints the artist half of the shelf code and then a literal hyphen
 * before the number input, rendering `MO 12/-5` for a release that is filed
 * as `MO 12/5`. Dropped: this is the field a librarian reads the call number
 * off and writes on the sleeve, so a punctuation mark that is not part of the
 * code is worse than a faithful one.
 */
export function RotationImportReleaseForm({
  artistLabel,
  codePrefix,
  release,
  onReleaseChange,
  formats,
  defaultCodeNumber,
  codeInUse,
  needsLabel,
  validationMessage,
  submitting,
  onChooseDifferentArtist,
  onSubmit,
}: {
  artistLabel: string;
  codePrefix: string;
  release: ReleaseFormState;
  onReleaseChange: (patch: Partial<ReleaseFormState>) => void;
  formats: LibraryFormatRow[];
  defaultCodeNumber: string;
  codeInUse: boolean;
  needsLabel: boolean;
  validationMessage: string | null;
  submitting: boolean;
  onChooseDifferentArtist: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div style={{ textAlign: "center", margin: "20px 0 10px 0" }}>
        <span className="title">Adding to: {artistLabel}</span>
        <br />
        <button
          type="button"
          className="link-button"
          style={{ fontSize: "0.85em" }}
          onClick={onChooseDifferentArtist}
        >
          Choose a different artist
        </button>
      </div>

      <form
        name="importToLibrary"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <table cellPadding={8} style={{ margin: "0 auto" }}>
          <tbody>
            <RotationImportReleaseFields
              value={release}
              onChange={onReleaseChange}
              formats={formats}
              codePrefix={codePrefix}
              defaultCodeNumber={defaultCodeNumber}
              codeInUse={codeInUse}
              needsLabel={needsLabel}
              disabled={submitting}
            />
            <tr>
              <td />
              <td>
                <ValidationMessage message={validationMessage} />
              </td>
            </tr>
            <tr>
              <td />
              <td>
                <input type="submit" value="Import to Library" disabled={submitting} />
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </>
  );
}

/**
 * `rotationReleaseImportNewArtist.jsp` — one form that mints the library code
 * and files the release under it in a single submission.
 *
 * Genre sits inside the form, where the JSP puts it. The JSP seeds it from
 * the rotation row's CMJ genre flags; those flags have no column on Backend's
 * `rotation` and are not reproduced, so the select opens unchosen rather than
 * defaulting to Rock on no evidence.
 *
 * Call letters are suggested from the *presentation* name, with the advisory
 * beside them. The Java derives them from the alphabetical name, which a
 * rotation row has no column for.
 */
export function RotationImportNewArtistForm({
  artist,
  onArtistChange,
  release,
  onReleaseChange,
  genres,
  formats,
  defaultCodeNumber,
  codeInUse,
  needsLabel,
  validationMessage,
  submitting,
  onSubmit,
}: {
  artist: NewArtistFormState;
  onArtistChange: (patch: Partial<NewArtistFormState>) => void;
  release: ReleaseFormState;
  onReleaseChange: (patch: Partial<ReleaseFormState>) => void;
  genres: LibraryGenreRow[];
  formats: LibraryFormatRow[];
  defaultCodeNumber: string;
  codeInUse: boolean;
  needsLabel: boolean;
  validationMessage: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const genreFieldId = useId();
  const callLettersId = useId();
  const callNumbersId = useId();
  const presentationNameId = useId();
  const alphabeticalNameId = useId();

  return (
    <form
      name="importToLibraryNewArtist"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <table cellPadding={8} style={{ margin: "0 auto" }}>
        <tbody>
          <tr>
            <td colSpan={2} className="title" style={{ paddingBottom: 5 }}>
              New Artist
            </td>
          </tr>
          <tr>
            <td className="redlabel" style={{ textAlign: "right" }}>
              <label htmlFor={genreFieldId}>Genre:</label>
            </td>
            <td>
              <select
                id={genreFieldId}
                value={artist.genreId ?? ""}
                disabled={submitting}
                onChange={(e) =>
                  onArtistChange({ genreId: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">-- Choose a genre --</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.genre_name}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td className="redlabel" style={{ textAlign: "right" }}>
              <label htmlFor={callLettersId}>Call Letters:</label>
            </td>
            <td>
              <input
                id={callLettersId}
                type="text"
                size={5}
                value={artist.callLetters}
                disabled={submitting}
                onChange={(e) => onArtistChange({ callLetters: e.target.value })}
              />
              <div className="smalllabel">{CALL_LETTERS_ADVISORY}</div>
            </td>
          </tr>
          <tr>
            <td className="redlabel" style={{ textAlign: "right" }}>
              <label htmlFor={callNumbersId}>Call Numbers:</label>
            </td>
            <td>
              <input
                id={callNumbersId}
                type="text"
                size={5}
                value={artist.callNumbers}
                disabled={submitting}
                onChange={(e) => onArtistChange({ callNumbers: e.target.value })}
              />
            </td>
          </tr>
          <tr>
            <td className="redlabel" style={{ textAlign: "right" }}>
              <label htmlFor={presentationNameId}>Presentation Name:</label>
            </td>
            <td>
              <input
                id={presentationNameId}
                type="text"
                size={50}
                value={artist.presentationName}
                disabled={submitting}
                onChange={(e) => onArtistChange({ presentationName: e.target.value })}
              />
            </td>
          </tr>
          <tr>
            <td className="label" style={{ textAlign: "right" }}>
              <label htmlFor={alphabeticalNameId}>Alphabetical Name:</label>
            </td>
            <td>
              <input
                id={alphabeticalNameId}
                type="text"
                size={50}
                value={artist.alphabeticalName}
                disabled={submitting}
                onChange={(e) => onArtistChange({ alphabeticalName: e.target.value })}
              />
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <hr />
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="title" style={{ paddingBottom: 5 }}>
              Release
            </td>
          </tr>
          <RotationImportReleaseFields
            value={release}
            onChange={onReleaseChange}
            formats={formats}
            defaultCodeNumber={defaultCodeNumber}
            codeInUse={codeInUse}
            needsLabel={needsLabel}
            disabled={submitting}
          />
          <tr>
            <td />
            <td>
              <ValidationMessage message={validationMessage} />
            </td>
          </tr>
          <tr>
            <td />
            <td>
              <input
                type="submit"
                value="Create Artist and Import to Library"
                disabled={submitting}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </form>
  );
}
