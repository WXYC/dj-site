import { http, HttpResponse } from "msw";
import { server } from "./server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../helpers/constants";

type FilingRequestBody = {
  artist:
    | { kind: "existing"; artist_id: number }
    | {
        kind: "create";
        artist_name: string;
        code_letters: string;
        genre_id: number;
        code_number?: number;
        alphabetical_name?: string;
      };
  release: {
    album_title: string;
    genre_id: number;
    format_id: number;
    label?: string;
    label_id?: number;
  };
  rotation?: { rotation_bin: string; card_id?: number; urls?: string[] };
};

export type FakeFilingArtistRow = {
  id: number;
  artist_name: string;
  code_letters: string;
  code_artist_number: number;
  genre_id: number;
};

/**
 * Stand-in for `POST /library/filings` (Backend-Service's transactional
 * artist+release+rotation composite, BS#2486 — the endpoint may not be
 * deployed to staging yet, so these fakes carry the contract the tests pin).
 * A response is synthesized from the request the way the composite promises:
 * `kind: "existing"` resolves against `existingArtists`, `kind: "create"`
 * mints a row (`assignedCodeNumber` standing in for the server's next-in-
 * bucket assignment when the request omits `code_number`), and `rotation`
 * appears in the response exactly when the request asked for one.
 *
 * `respond` overrides the whole answer for a given body — return a 409/5xx
 * there to exercise a refusal; return undefined to fall through to success.
 *
 * The release must carry at least one of `label`/`label_id` (the
 * AlbumCreateFields rule the composite enforces); a release with neither is
 * answered 400, so a bench that files a blank label fails here rather than
 * only in production. `card_id` stays optional — the server files cardless
 * rotation rows; requiring a card is client policy, not the contract.
 */
export function fakeLibraryFilingsEndpoint(
  options: {
    existingArtists?: FakeFilingArtistRow[];
    assignedCodeNumber?: number;
    respond?: (body: FilingRequestBody) => Response | undefined;
  } = {},
) {
  const bodies: FilingRequestBody[] = [];
  let nextArtistId = 900;
  let nextReleaseId = 4200;
  let nextRotationId = 9000;
  let nextReleaseCode = 1;

  server.use(
    http.post(`${BACKEND_URL}/library/filings`, async ({ request }) => {
      const body = (await request.json()) as FilingRequestBody;
      bodies.push(body);
      const override = options.respond?.(body);
      if (override) return override;

      if (body.release.label === undefined && body.release.label_id === undefined) {
        return HttpResponse.json(
          { message: "release requires at least one of label, label_id" },
          { status: 400 },
        );
      }

      const requestedArtist = body.artist;
      const artist =
        requestedArtist.kind === "existing"
          ? (options.existingArtists?.find((row) => row.id === requestedArtist.artist_id) ?? {
              id: requestedArtist.artist_id,
              artist_name: "Uncatalogued Artist",
              code_letters: "??",
              code_artist_number: 0,
              genre_id: body.release.genre_id,
            })
          : {
              id: nextArtistId++,
              artist_name: requestedArtist.artist_name,
              code_letters: requestedArtist.code_letters,
              code_artist_number:
                requestedArtist.code_number ?? options.assignedCodeNumber ?? 7,
              genre_id: requestedArtist.genre_id,
            };

      const release = {
        id: nextReleaseId++,
        artist_id: artist.id,
        album_title: body.release.album_title,
        code_number: nextReleaseCode++,
        genre_id: body.release.genre_id,
        format_id: body.release.format_id,
        ...(body.release.label !== undefined ? { label: body.release.label } : {}),
      };

      const rotation = body.rotation
        ? {
            id: nextRotationId++,
            album_id: release.id,
            rotation_bin: body.rotation.rotation_bin,
            add_date: "2026-09-13",
            ...(body.rotation.card_id !== undefined
              ? {
                  card: {
                    id: body.rotation.card_id,
                    bin: body.rotation.rotation_bin,
                    number: 1,
                  },
                }
              : {}),
            ...(body.rotation.urls !== undefined ? { urls: body.rotation.urls } : {}),
          }
        : undefined;

      return HttpResponse.json(
        { artist, release, ...(rotation !== undefined ? { rotation } : {}) },
        { status: 201 },
      );
    }),
  );

  return { bodies: () => [...bodies] };
}

/**
 * A `LibraryFilingConflictError` refusal, shaped per the contract: `artist`
 * present on the two artist reasons (the holder being collided with), absent
 * on `rotation_card_bin_mismatch`, which has no artist to name.
 */
export function filingConflictResponse(
  reason: "artist_code_conflict" | "artist_name_conflict" | "rotation_card_bin_mismatch",
  artist?: FakeFilingArtistRow,
) {
  return HttpResponse.json(
    {
      message: `Refused: ${reason}`,
      reason,
      ...(artist !== undefined ? { artist } : {}),
    },
    { status: 409 },
  );
}
