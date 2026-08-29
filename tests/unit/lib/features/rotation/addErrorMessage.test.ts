import { describe, it, expect } from "vitest";
import { rotationAddErrorMessage } from "@/lib/features/rotation/addErrorMessage";

describe("rotationAddErrorMessage", () => {
  it("surfaces the server's message from an RTK Query error", () => {
    const err = { data: { message: "Missing Parameters: album_id, or artist_name and album_title" } };
    expect(rotationAddErrorMessage(err)).toBe(
      "Missing Parameters: album_id, or artist_name and album_title",
    );
  });

  it("falls back to a generic message for a thrown Error", () => {
    expect(rotationAddErrorMessage(new Error("network down"))).toBe("network down");
  });

  it("falls back to a generic message for a plain string rejection", () => {
    expect(rotationAddErrorMessage("boom")).toBe("boom");
  });

  it("falls back to a generic message when nothing usable is present", () => {
    expect(rotationAddErrorMessage({ status: 500 })).toBe("Failed to add rotation release.");
  });

  it("falls back to a generic message for a non-string server message", () => {
    expect(rotationAddErrorMessage({ data: { message: 42 } })).toBe("Failed to add rotation release.");
  });
});
