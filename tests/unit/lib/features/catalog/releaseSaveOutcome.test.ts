import { describe, it, expect } from "vitest";
import {
  interpretReleaseSaveError,
  isExpectedReleaseSaveRefusal,
  RELEASE_EDIT_FALLBACK_MESSAGE,
  RELEASE_MODERN_FALLBACK_MESSAGE,
  RELEASE_MOVE_FALLBACK_MESSAGE,
  type ReleaseSaveContext,
} from "@/lib/features/catalog/releaseSaveOutcome";

const slotTaken = { status: 409, data: { message: "Call number 135 is already taken", code: "library_slot_conflict" } };
const notInGenre = { status: 400, data: { message: "Artist is not catalogued in the selected genre" } };

const editor: ReleaseSaveContext = {
  screen: "editor",
  genreName: "Electronic",
  callNumber: "135",
  artistName: "Various Artists",
  variousArtists: true,
};
const move: ReleaseSaveContext = { ...editor, screen: "move" };
const modern: ReleaseSaveContext = { ...editor, screen: "modern" };
const ordinary: ReleaseSaveContext = { ...editor, artistName: "Juana Molina", variousArtists: false };

describe("interpretReleaseSaveError", () => {
  it.each([
    {
      label: "a taken call number, on the editor",
      err: slotTaken,
      context: editor,
      reason: "slot_taken",
      message:
        "Electronic already has a release at number 135. Change the Release Call Number on this page and save again.",
    },
    {
      label: "a taken call number, on the move screen",
      err: slotTaken,
      context: move,
      reason: "slot_taken",
      message:
        "Electronic already has a release at number 135. Open View/Modify/Delete this Library Release to change its Release Call Number, then move it again.",
    },
    {
      label: "a Various Artists release whose bucket is not filed in the genre",
      err: notInGenre,
      context: editor,
      reason: "artist_not_in_genre",
      message:
        "Various Artists isn't filed under Electronic, so this release can't be moved there. Use Change the Library Code of This Library Release to file it under a different artist.",
    },
    {
      label: "an ordinary artist not filed in the genre",
      err: notInGenre,
      context: ordinary,
      reason: "artist_not_in_genre",
      message: "Juana Molina isn't filed under Electronic yet. File the artist under Electronic first, then move this release.",
    },
    {
      label: "a taken call number, on the modern editor",
      err: slotTaken,
      context: modern,
      reason: "slot_taken",
      message: "Electronic already has a release at number 135, so this release can't be moved there.",
    },
    {
      label: "a taken call number whose number the screen cannot know, on the modern editor",
      err: slotTaken,
      context: { ...modern, callNumber: undefined },
      reason: "slot_taken",
      message: "Electronic already has a release at that number, so this release can't be moved there.",
    },
    {
      label: "a Various Artists release not filed in the genre, on the modern editor",
      err: notInGenre,
      context: modern,
      reason: "artist_not_in_genre",
      message: "Various Artists isn't filed under Electronic, so this release can't be moved there.",
    },
    {
      label: "an ordinary artist not filed in the genre, on the modern editor",
      err: notInGenre,
      context: { ...modern, artistName: "Juana Molina", variousArtists: false },
      reason: "artist_not_in_genre",
      message: "Juana Molina isn't filed under Electronic yet. File the artist under Electronic first, then move this release.",
    },
    {
      label: "a server error, on the modern editor",
      err: { status: 500, data: { message: "boom" } },
      context: modern,
      reason: "generic",
      message: RELEASE_MODERN_FALLBACK_MESSAGE,
    },
    {
      label: "a taken call number marked expected by the endpoint",
      err: { ...slotTaken, expected: true },
      context: editor,
      reason: "slot_taken",
      message:
        "Electronic already has a release at number 135. Change the Release Call Number on this page and save again.",
    },
    {
      label: "a 409 carrying some other code",
      err: { status: 409, data: { code: "something_else" } },
      context: editor,
      reason: "generic",
      message: RELEASE_EDIT_FALLBACK_MESSAGE,
    },
    {
      label: "a 400 with some other message",
      err: { status: 400, data: { message: "album_title is required" } },
      context: move,
      reason: "generic",
      message: RELEASE_MOVE_FALLBACK_MESSAGE,
    },
    {
      label: "a server error",
      err: { status: 500, data: { message: "boom" } },
      context: editor,
      reason: "generic",
      message: RELEASE_EDIT_FALLBACK_MESSAGE,
    },
    {
      label: "a rejection that is not an HTTP answer",
      err: undefined,
      context: editor,
      reason: "generic",
      message: RELEASE_EDIT_FALLBACK_MESSAGE,
    },
    {
      label: "a refusal whose genre name is unknown",
      err: slotTaken,
      context: { ...editor, genreName: undefined },
      reason: "generic",
      message: RELEASE_EDIT_FALLBACK_MESSAGE,
    },
  ])("$label", ({ err, context, reason, message }) => {
    expect(interpretReleaseSaveError(err, context)).toEqual({ reason, message });
  });
});

describe("isExpectedReleaseSaveRefusal", () => {
  it.each([
    { label: "a taken call number", response: slotTaken, expected: true },
    { label: "an artist not filed in the genre", response: notInGenre, expected: true },
    { label: "a 409 carrying some other code", response: { status: 409, data: { code: "something_else" } }, expected: false },
    { label: "a 400 with some other message", response: { status: 400, data: { message: "album_title is required" } }, expected: false },
    { label: "the slot code on a non-409", response: { status: 400, data: { code: "library_slot_conflict" } }, expected: false },
    { label: "a server error", response: { status: 500, data: { message: "boom" } }, expected: false },
    { label: "a network failure", response: { status: "FETCH_ERROR", error: "TypeError: Failed to fetch" }, expected: false },
  ])("$label", ({ response, expected }) => {
    expect(isExpectedReleaseSaveRefusal(response)).toBe(expected);
  });
});
