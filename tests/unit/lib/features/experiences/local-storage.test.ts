import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { APP_SKIN_STORAGE_KEY } from "@/lib/features/experiences/preferences";
import {
  readLocalAppSkin,
  writeLocalAppSkin,
} from "@/lib/features/experiences/local-storage";

// The global setup swaps window.localStorage for a stub, so these drive that
// stub directly rather than round-tripping through real storage.
const getItem = localStorage.getItem as unknown as ReturnType<typeof vi.fn>;
const setItem = localStorage.setItem as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  getItem.mockReset().mockReturnValue(null);
  setItem.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readLocalAppSkin", () => {
  it("returns null when nothing is stored", () => {
    expect(readLocalAppSkin()).toBeNull();
    expect(getItem).toHaveBeenCalledWith(APP_SKIN_STORAGE_KEY);
  });

  it.each(["classic-light", "classic-dark", "modern-bluenote-dark"])(
    "returns the stored preference %s",
    (preference) => {
      getItem.mockReturnValue(preference);
      expect(readLocalAppSkin()).toBe(preference);
    }
  );

  // A stored value that no longer parses must read as absent rather than
  // propagate: callers treat null as "no local preference" and fall back to the
  // cookie, whereas a malformed string would flow into the skin grammar.
  it.each(["", "nonsense", "classic-teal-light", "modern"])(
    "returns null for the unparseable value %s",
    (stored) => {
      getItem.mockReturnValue(stored);
      expect(readLocalAppSkin()).toBeNull();
    }
  );

  it("returns null rather than throwing when storage is unavailable", () => {
    getItem.mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readLocalAppSkin()).toBeNull();
  });
});

describe("writeLocalAppSkin", () => {
  it("writes the preference under the shared storage key", () => {
    writeLocalAppSkin("modern-bluenote-light");
    expect(setItem).toHaveBeenCalledWith(
      APP_SKIN_STORAGE_KEY,
      "modern-bluenote-light"
    );
  });

  // Safari private mode and a full quota both throw on write. The preference is
  // still headed for the cookie and the account record, so a failed local cache
  // must not abort the caller.
  it("does not throw when storage rejects the write", () => {
    setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeLocalAppSkin("classic-dark")).not.toThrow();
  });
});
