import { describe, it, expect, afterEach } from "vitest";

import { isCatalogTrackSearchUiEnabled } from "@/lib/features/catalog/flags";

const ENV_KEY = "NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("isCatalogTrackSearchUiEnabled", () => {
  it("returns false when the env var is undefined (default off)", () => {
    delete process.env[ENV_KEY];
    expect(isCatalogTrackSearchUiEnabled()).toBe(false);
  });

  it.each(["true", "1"])(
    "returns true when env var is %s",
    (value) => {
      process.env[ENV_KEY] = value;
      expect(isCatalogTrackSearchUiEnabled()).toBe(true);
    }
  );

  it.each(["false", "0", "", "yes", "TRUE", "  true  "])(
    "returns false when env var is %s (only exact 'true'/'1' opt in)",
    (value) => {
      process.env[ENV_KEY] = value;
      expect(isCatalogTrackSearchUiEnabled()).toBe(false);
    }
  );
});
