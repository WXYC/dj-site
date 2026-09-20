import { describe, it, expect } from "vitest";
import {
  rotationWriteErrorMessage,
  wrapRotationWriteError,
} from "@/lib/features/rotation/writeErrorMessage";

const FALLBACK = "Could not update rotation";

describe("rotationWriteErrorMessage", () => {
  it("prefers the server's message off the wrapped rejection", () => {
    const wrapped = wrapRotationWriteError({ status: 400, data: { message: "Show not live" } });
    expect(rotationWriteErrorMessage(wrapped, FALLBACK)).toBe("Show not live");
  });

  // The shared write path rejects with a bare string when no DJ is signed
  // in; this never reaches the wrap key, so it must pass through untouched.
  it("passes a bare-string rejection through verbatim", () => {
    expect(rotationWriteErrorMessage("User not logged in", FALLBACK)).toBe("User not logged in");
  });

  it("falls back to the caller's own copy when the wrapped rejection has no message", () => {
    const wrapped = wrapRotationWriteError({ status: 500, data: {} });
    expect(rotationWriteErrorMessage(wrapped, FALLBACK)).toBe(FALLBACK);
  });

  it.each([[undefined], [null], [{}]])("falls back to the caller's own copy for %p", (err) => {
    expect(rotationWriteErrorMessage(err, FALLBACK)).toBe(FALLBACK);
  });
});
