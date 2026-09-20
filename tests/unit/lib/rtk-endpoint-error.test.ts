import { describe, expect, it } from "vitest";

import {
  bodyField,
  bodyReason,
  serverMessage,
  statusAndReasonMatch,
  unwrapEndpointError,
  unwrapEndpointErrorOrRaw,
} from "@/lib/rtk-endpoint-error";

describe("unwrapEndpointError", () => {
  it("reads the inner rejection off the wrap key", () => {
    const inner = { status: 409, data: { reason: "lock_unavailable" } };
    expect(unwrapEndpointError("deleteAlbumError", { deleteAlbumError: inner })).toBe(inner);
  });

  it("returns undefined for an unwrapped rejection", () => {
    expect(unwrapEndpointError("deleteAlbumError", { status: 409 })).toBeUndefined();
  });

  it.each([[undefined], [null], ["oops"], [42]])(
    "returns undefined for %p",
    (value) => {
      expect(unwrapEndpointError("deleteAlbumError", value)).toBeUndefined();
    },
  );
});

describe("unwrapEndpointErrorOrRaw", () => {
  it("prefers the wrapped shape when present", () => {
    const inner = { status: 409 };
    expect(unwrapEndpointErrorOrRaw("deleteAlbumError", { deleteAlbumError: inner })).toBe(inner);
  });

  it("falls back to the rejection itself when unwrapped", () => {
    const raw = { status: 409 };
    expect(unwrapEndpointErrorOrRaw("deleteAlbumError", raw)).toBe(raw);
  });

  it("returns undefined for a non-object rejection", () => {
    expect(unwrapEndpointErrorOrRaw("deleteAlbumError", "oops")).toBeUndefined();
    expect(unwrapEndpointErrorOrRaw("deleteAlbumError", undefined)).toBeUndefined();
  });
});

describe("serverMessage", () => {
  it("reads a non-blank string message", () => {
    expect(serverMessage({ message: "Album not found" })).toBe("Album not found");
  });

  it.each([[""], ["   "]])("treats %p as absent", (message) => {
    expect(serverMessage({ message })).toBeUndefined();
  });

  it.each([[undefined], [null], [{ message: 42 }], ["oops"]])(
    "treats %p as absent",
    (data) => {
      expect(serverMessage(data)).toBeUndefined();
    },
  );
});

describe("bodyReason", () => {
  it("reads a string reason", () => {
    expect(bodyReason({ reason: "not_found" })).toBe("not_found");
  });

  it.each([[undefined], [{ reason: 1 }], ["oops"]])("treats %p as absent", (data) => {
    expect(bodyReason(data)).toBeUndefined();
  });
});

describe("bodyField", () => {
  const isNumber = (value: unknown): value is number => typeof value === "number";

  it("reads a field matching the guard", () => {
    expect(bodyField({ asset_count: 3 }, "asset_count", isNumber)).toBe(3);
  });

  it("returns undefined when the field fails the guard", () => {
    expect(bodyField({ asset_count: "three" }, "asset_count", isNumber)).toBeUndefined();
  });

  it("returns undefined for a missing body", () => {
    expect(bodyField(undefined, "asset_count", isNumber)).toBeUndefined();
  });
});

describe("statusAndReasonMatch", () => {
  it("matches when both the status and the reason agree", () => {
    expect(
      statusAndReasonMatch({ status: 503, data: { reason: "lock_unavailable" } }, 503, "lock_unavailable"),
    ).toBe(true);
  });

  it("refuses a matching reason on the wrong status", () => {
    expect(
      statusAndReasonMatch({ status: 500, data: { reason: "lock_unavailable" } }, 503, "lock_unavailable"),
    ).toBe(false);
  });

  it("refuses a matching status with no body", () => {
    expect(statusAndReasonMatch({ status: 503, data: undefined }, 503, "lock_unavailable")).toBe(false);
  });

  it("refuses when inner is undefined", () => {
    expect(statusAndReasonMatch(undefined, 503, "lock_unavailable")).toBe(false);
  });
});
