import { describe, it, expect, afterEach } from "vitest";

import {
  isCatalogTrackSearchUiEnabled,
  isClassicCrossReferencesEnabled,
  isClassicLibrarianNavEnabled,
} from "@/lib/features/catalog/flags";

const ENV_KEY = "NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED";
const LIBRARIAN_NAV_ENV_KEY = "NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED";
const CROSSREFERENCES_ENV_KEY = "NEXT_PUBLIC_CLASSIC_CROSSREFERENCES_ENABLED";

afterEach(() => {
  delete process.env[ENV_KEY];
  delete process.env[LIBRARIAN_NAV_ENV_KEY];
  delete process.env[CROSSREFERENCES_ENV_KEY];
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

describe("isClassicLibrarianNavEnabled", () => {
  it("returns false when the env var is undefined (default off)", () => {
    delete process.env[LIBRARIAN_NAV_ENV_KEY];
    expect(isClassicLibrarianNavEnabled()).toBe(false);
  });

  it.each(["true", "1"])("returns true when env var is %s", (value) => {
    process.env[LIBRARIAN_NAV_ENV_KEY] = value;
    expect(isClassicLibrarianNavEnabled()).toBe(true);
  });

  it.each(["false", "0", "", "yes", "TRUE", "  true  "])(
    "returns false when env var is %s (only exact 'true'/'1' opt in)",
    (value) => {
      process.env[LIBRARIAN_NAV_ENV_KEY] = value;
      expect(isClassicLibrarianNavEnabled()).toBe(false);
    }
  );

  it("is independent of the track-search flag", () => {
    process.env[ENV_KEY] = "true";
    expect(isClassicLibrarianNavEnabled()).toBe(false);
  });
});

describe("isClassicCrossReferencesEnabled", () => {
  it("returns false when the env var is undefined (default off)", () => {
    delete process.env[CROSSREFERENCES_ENV_KEY];
    expect(isClassicCrossReferencesEnabled()).toBe(false);
  });

  it.each(["true", "1"])("returns true when env var is %s", (value) => {
    process.env[CROSSREFERENCES_ENV_KEY] = value;
    expect(isClassicCrossReferencesEnabled()).toBe(true);
  });

  it.each(["false", "0", "", "yes", "TRUE", "  true  "])(
    "returns false when env var is %s (only exact 'true'/'1' opt in)",
    (value) => {
      process.env[CROSSREFERENCES_ENV_KEY] = value;
      expect(isClassicCrossReferencesEnabled()).toBe(false);
    }
  );

  // The librarian nav is already ON in production, so riding it would publish
  // these two entries the moment this merges — against a backend that does not
  // serve their endpoints yet. The flags have to move independently.
  it("stays off when only the librarian nav flag is set", () => {
    process.env[LIBRARIAN_NAV_ENV_KEY] = "true";
    expect(isClassicCrossReferencesEnabled()).toBe(false);
  });
});
