import { describe, it, expect } from "vitest";
import {
  interpretReleaseSaveError,
  RELEASE_EDIT_FALLBACK_MESSAGE,
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
