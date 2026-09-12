import { describe, it, expect } from "vitest";
import {
  LINK_ROTATION_INDETERMINATE_MESSAGE,
  LINK_ROTATION_ROW_GONE_MESSAGE,
  LINK_ROTATION_ALBUM_GONE_MESSAGE,
  LINK_ROTATION_FALLBACK_MESSAGE,
  isRotationAlreadyLinked,
  linkRotationFailureMessage,
} from "@/lib/features/rotation/importOutcome";

const wrapped = (status: number | string, data?: unknown) => ({
  linkRotationError: { status, data } as never,
});

describe("isRotationAlreadyLinked", () => {
  it("recognises the link endpoint's 409", () => {
    expect(
      isRotationAlreadyLinked(
        wrapped(409, { message: "Rotation entry is already linked to a library release" }),
      ),
    ).toBe(true);
  });

  it.each([
    { label: "a 404", err: wrapped(404, { message: "Rotation entry not found" }) },
    { label: "a 500", err: wrapped(500) },
    { label: "a transport failure", err: wrapped("FETCH_ERROR") },
    { label: "an unwrapped rejection", err: { status: 409 } },
    { label: "a bare string", err: "409" },
    { label: "nothing at all", err: undefined },
  ])("does not read $label as an existing link", ({ err }) => {
    expect(isRotationAlreadyLinked(err)).toBe(false);
  });
});

describe("linkRotationFailureMessage", () => {
  // The two 404s are different objects gone missing, and the librarian's next
  // move differs: a missing rotation row means the queue entry was deleted
  // under them, a missing album means the release this import just created is
  // not in the catalog after all.
  it("tells the two 404s apart by the sentence the server sent", () => {
    expect(linkRotationFailureMessage(wrapped(404, { message: "Rotation entry not found" }))).toBe(
      LINK_ROTATION_ROW_GONE_MESSAGE,
    );
    expect(linkRotationFailureMessage(wrapped(404, { message: "Album not found" }))).toBe(
      LINK_ROTATION_ALBUM_GONE_MESSAGE,
    );
  });

  it("falls back to the rotation-row wording for a 404 with no usable sentence", () => {
    expect(linkRotationFailureMessage(wrapped(404, { message: "" }))).toBe(
      LINK_ROTATION_ROW_GONE_MESSAGE,
    );
  });

  // A 5xx, a dropped connection or an unparseable body leaves the link's
  // outcome genuinely unknown -- it may have committed on a response that
  // never arrived -- so the message must claim neither.
  it.each([
    { label: "a 500", err: wrapped(500) },
    { label: "a transport failure", err: wrapped("FETCH_ERROR") },
    { label: "an unwrapped rejection", err: { status: 503 } },
  ])("refuses to claim an outcome for $label", ({ err }) => {
    expect(linkRotationFailureMessage(err)).toBe(LINK_ROTATION_INDETERMINATE_MESSAGE);
  });

  it("says nothing was changed when the server answered below 500 with no reason it knows", () => {
    expect(linkRotationFailureMessage(wrapped(400, { message: "" }))).toBe(
      LINK_ROTATION_FALLBACK_MESSAGE,
    );
  });

  it("prefers the server's own sentence for a refusal it cannot classify", () => {
    expect(linkRotationFailureMessage(wrapped(400, { message: "album_id must be a positive integer" }))).toBe(
      "album_id must be a positive integer",
    );
  });
});
