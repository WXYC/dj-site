import type { FilingArtistCreate, LibraryFilingRequest, RotationBin } from "@wxyc/shared";
import { parseRequiredNonNegativeInt } from "./adminCreateArtistValidation";

/**
 * What the filing bench knows about the artist at submit time. The two arms
 * come from the form's own state machine — a typeahead pick holds an id, an
 * expanded create panel holds field drafts — and the builder maps each onto
 * the wire union's `kind` explicitly, never inferring it from which fields
 * happen to be present.
 */
export type FilingArtistInput =
  | { mode: "existing"; artistId: number }
  | {
      mode: "create";
      artistName: string;
      codeLetters: string;
      /**
       * The code-number field's raw draft. Empty means the field was never
       * dirtied: `code_number` is omitted and the server assigns the next
       * number in the `(code_letters, genre_id)` bucket. A non-empty draft is
       * the MD's deliberate number and is sent as typed — never silently
       * rewritten to whatever the peek last previewed. 0 is a legal deliberate
       * number (the compilation bucket lives at 0), so the parse must not
       * read it as absent.
       */
      codeNumberRaw: string;
      alphabeticalName: string;
    };

export type LibraryFilingInput = {
  artist: FilingArtistInput;
  genreId: number;
  formatId: number;
  albumTitle: string;
  label: string;
  /** Null files library-only: the request carries no `rotation` member at all. */
  rotationBin: RotationBin | null;
  cardId: number | null;
  urls: string[];
};

function buildCreateArtist(
  artist: Extract<FilingArtistInput, { mode: "create" }>,
  genreId: number,
): FilingArtistCreate {
  const codeNumber = parseRequiredNonNegativeInt(artist.codeNumberRaw);
  const alphabeticalName = artist.alphabeticalName.trim();
  // An unparseable non-empty draft also omits the field, but only nominally:
  // the form's submit gate blocks on `codeNumberInvalid`, so the case cannot
  // reach a request. `alphabetical_name` mirrors `AddArtistRequestBody`'s
  // relationship to the published `AddArtistRequest`: the backend accepts it,
  // the shared type lags behind.
  const body: FilingArtistCreate & { alphabetical_name?: string } = {
    kind: "create",
    artist_name: artist.artistName.trim(),
    code_letters: artist.codeLetters.trim(),
    genre_id: genreId,
    ...(codeNumber !== null ? { code_number: codeNumber } : {}),
    ...(alphabeticalName !== "" ? { alphabetical_name: alphabeticalName } : {}),
  };
  return body;
}

/** Assembles the one `POST /library/filings` body the bench submits. */
export function buildLibraryFilingRequest(input: LibraryFilingInput): LibraryFilingRequest {
  const label = input.label.trim();
  const rotation =
    input.rotationBin === null
      ? undefined
      : {
          rotation_bin: input.rotationBin,
          ...(input.cardId !== null ? { card_id: input.cardId } : {}),
          ...(input.urls.length > 0 ? { urls: input.urls } : {}),
        };

  return {
    artist:
      input.artist.mode === "existing"
        ? { kind: "existing", artist_id: input.artist.artistId }
        : buildCreateArtist(input.artist, input.genreId),
    release: {
      album_title: input.albumTitle.trim(),
      genre_id: input.genreId,
      format_id: input.formatId,
      ...(label !== "" ? { label } : {}),
    },
    ...(rotation !== undefined ? { rotation } : {}),
  };
}
