import { describe, it, expect } from "vitest";
import {
  artistRefileAnsweredWithoutWriting,
  interpretArtistRefileError,
  ARTIST_REFILE_FALLBACK_MESSAGE,
  ARTIST_REFILE_INDETERMINATE_MESSAGE,
  ARTIST_REFILE_LOCK_MESSAGE,
  ARTIST_REFILE_VARIOUS_ARTISTS_MESSAGE,
} from "@/lib/features/catalog/artistRefileOutcome";

const wrapped = (status: number | string, data?: unknown) => ({
  refileArtistError: { status, data },
});

const holder = { id: 7, artist_name: "Autechre", code_letters: "IS", code_artist_number: 31, genre_id: 6 };

describe("artistRefileAnsweredWithoutWriting", () => {
  it.each([
    { label: "wrapped 409", err: wrapped(409, {}), expected: true },
    { label: "wrapped 404", err: wrapped(404, {}), expected: true },
    { label: "raw 409", err: { status: 409, data: {} }, expected: true },
    { label: "wrapped 503", err: wrapped(503, {}), expected: false },
    { label: "wrapped 500", err: wrapped(500, {}), expected: false },
    { label: "raw 500", err: { status: 500 }, expected: false },
    { label: "wrapped FETCH_ERROR", err: wrapped("FETCH_ERROR"), expected: false },
    { label: "undefined", err: undefined, expected: false },
  ])("$label -> $expected", ({ err, expected }) => {
    expect(artistRefileAnsweredWithoutWriting(err)).toBe(expected);
  });
});

describe("interpretArtistRefileError", () => {
  it.each([
    {
      label: "conflict names the holder",
      err: wrapped(409, { message: "held", reason: "artist_code_conflict", artist: holder }),
      reason: "conflict",
      holder,
      retryable: false,
    },
    {
      label: "conflict with no readable holder",
      err: wrapped(409, { message: "held", reason: "artist_code_conflict" }),
      reason: "conflict",
      holder: undefined,
      retryable: false,
    },
    {
      label: "conflict whose holder has no numeric id",
      err: wrapped(409, { message: "held", reason: "artist_code_conflict", artist: { artist_name: "Autechre" } }),
      reason: "conflict",
      holder: undefined,
      retryable: false,
    },
    {
      label: "conflict whose holder has no code_letters string",
      err: wrapped(409, { message: "held", reason: "artist_code_conflict", artist: { id: 7, artist_name: "Autechre", code_letters: null } }),
      reason: "conflict",
      holder: undefined,
      retryable: false,
    },
    {
      label: "lettered compilation section",
      err: wrapped(409, { message: "x", reason: "lettered_compilation_section" }),
      reason: "lettered_section",
      retryable: false,
    },
    {
      label: "various artists section",
      err: wrapped(409, { message: "x", reason: "various_artists_section" }),
      reason: "various_artists_section",
      retryable: false,
      message: ARTIST_REFILE_VARIOUS_ARTISTS_MESSAGE,
    },
    {
      label: "not filed in genre",
      err: wrapped(404, { message: "Artist not filed under genre 6" }),
      reason: "not_filed_in_genre",
      retryable: false,
    },
    {
      label: "artist not found",
      err: wrapped(404, { message: "Artist not found" }),
      reason: "artist_not_found",
      retryable: false,
    },
    {
      label: "404 code not filed, message reworded",
      err: wrapped(404, { message: "No shelf entry", code: "artist_not_filed_in_genre" }),
      reason: "not_filed_in_genre",
      retryable: false,
    },
    {
      label: "404 code not found, message reworded",
      err: wrapped(404, { message: "Artist not filed under genre 6", code: "artist_not_found" }),
      reason: "artist_not_found",
      retryable: false,
    },
    {
      label: "404 unknown code is generic, not guessed from the prefix",
      err: wrapped(404, { message: "Artist not filed under genre 6", code: "from_the_future" }),
      reason: "generic",
      retryable: false,
      message: ARTIST_REFILE_FALLBACK_MESSAGE,
    },
    {
      label: "404 unknown code, other message, is generic",
      err: wrapped(404, { message: "Artist not found", code: "from_the_future" }),
      reason: "generic",
      retryable: false,
      message: ARTIST_REFILE_FALLBACK_MESSAGE,
    },
    {
      label: "404 numeric code falls back to the prefix",
      err: wrapped(404, { message: "Artist not filed under genre 6", code: 42 }),
      reason: "not_filed_in_genre",
      retryable: false,
    },
    {
      label: "404 null code falls back to the prefix",
      err: wrapped(404, { message: "Artist not filed under genre 6", code: null }),
      reason: "not_filed_in_genre",
      retryable: false,
    },
    {
      label: "404 null code, other message",
      err: wrapped(404, { message: "Artist not found", code: null }),
      reason: "artist_not_found",
      retryable: false,
    },
    {
      label: "404 with no body",
      err: wrapped(404),
      reason: "artist_not_found",
      retryable: false,
    },
    {
      label: "lock unavailable prefers the server sentence",
      err: wrapped(503, { message: "Shelf busy.", reason: "lock_unavailable" }),
      reason: "lock_unavailable",
      retryable: true,
      message: "Shelf busy.",
    },
    {
      label: "lock unavailable without a sentence",
      err: wrapped(503, { reason: "lock_unavailable" }),
      reason: "lock_unavailable",
      retryable: true,
      message: ARTIST_REFILE_LOCK_MESSAGE,
    },
    {
      label: "unrecognized 409 reason",
      err: wrapped(409, { message: "?", reason: "from_the_future" }),
      reason: "generic",
      retryable: false,
      message: ARTIST_REFILE_FALLBACK_MESSAGE,
    },
    {
      label: "409 with a non-object body",
      err: wrapped(409, "oops"),
      reason: "generic",
      retryable: false,
      message: ARTIST_REFILE_FALLBACK_MESSAGE,
    },
    {
      label: "400",
      err: wrapped(400, { message: "bad" }),
      reason: "generic",
      retryable: false,
      message: ARTIST_REFILE_FALLBACK_MESSAGE,
    },
    {
      label: "500 is indeterminate",
      err: wrapped(500, {}),
      reason: "generic",
      retryable: true,
      message: ARTIST_REFILE_INDETERMINATE_MESSAGE,
    },
    {
      label: "transport failure is indeterminate",
      err: wrapped("FETCH_ERROR"),
      reason: "generic",
      retryable: true,
      message: ARTIST_REFILE_INDETERMINATE_MESSAGE,
    },
    {
      label: "no error shape at all",
      err: undefined,
      reason: "generic",
      retryable: true,
      message: ARTIST_REFILE_INDETERMINATE_MESSAGE,
    },
  ])("$label", ({ err, reason, retryable, message, ...rest }) => {
    const outcome = interpretArtistRefileError(err);
    expect(outcome.reason).toBe(reason);
    expect(outcome.retryable).toBe(retryable);
    expect(outcome.message.length).toBeGreaterThan(0);
    if (message) expect(outcome.message).toBe(message);
    if ("holder" in rest) {
      expect(outcome.reason === "conflict" ? outcome.holder : "n/a").toEqual(rest.holder);
    }
  });

  it("never treats a prototype key as a reason", () => {
    expect(interpretArtistRefileError(wrapped(409, { reason: "__proto__" })).reason).toBe("generic");
  });
});
