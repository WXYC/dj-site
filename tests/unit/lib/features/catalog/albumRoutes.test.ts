import { describe, it, expect } from "vitest";
import {
  albumDetailHref,
  albumParentPath,
  parseAlbumIdFromPathname,
  withAlbumSegment,
} from "@/lib/features/catalog/albumRoutes";

describe("albumParentPath", () => {
  it("strips a trailing album segment", () => {
    expect(albumParentPath("/dashboard/catalog/album/42")).toBe("/dashboard/catalog");
    expect(albumParentPath("/dashboard/admin/roster/album/7")).toBe("/dashboard/admin/roster");
  });

  it("tolerates a trailing slash", () => {
    expect(albumParentPath("/dashboard/flowsheet/album/42/")).toBe("/dashboard/flowsheet");
  });

  it("returns the pathname unchanged when no album segment is present", () => {
    expect(albumParentPath("/dashboard/playlists")).toBe("/dashboard/playlists");
  });

  it("falls back to /dashboard when stripping empties the path", () => {
    expect(albumParentPath("/")).toBe("/dashboard");
  });
});

describe("albumDetailHref", () => {
  it("scopes the album to the current page", () => {
    expect(albumDetailHref("/dashboard/flowsheet", 8)).toBe("/dashboard/flowsheet/album/8");
    expect(albumDetailHref("/dashboard/admin/roster", 8)).toBe("/dashboard/admin/roster/album/8");
  });

  it("replaces an already-open album segment", () => {
    expect(albumDetailHref("/dashboard/catalog/album/42", 8)).toBe("/dashboard/catalog/album/8");
  });

  it("falls back to the catalog from pages without an album child route", () => {
    expect(albumDetailHref("/dashboard", 8)).toBe("/dashboard/catalog/album/8");
    expect(albumDetailHref("/dashboard/settings", 8)).toBe("/dashboard/catalog/album/8");
  });
});

describe("withAlbumSegment", () => {
  it("carries the open album onto another album-hosting page", () => {
    expect(withAlbumSegment("/dashboard/flowsheet", "/dashboard/catalog/album/4")).toBe(
      "/dashboard/flowsheet/album/4",
    );
    expect(withAlbumSegment("/dashboard/admin/roster", "/dashboard/playlists/album/9")).toBe(
      "/dashboard/admin/roster/album/9",
    );
  });

  it("returns the bare target when no album is open", () => {
    expect(withAlbumSegment("/dashboard/flowsheet", "/dashboard/catalog")).toBe(
      "/dashboard/flowsheet",
    );
  });

  it("returns the bare target for pages without an album child route", () => {
    expect(withAlbumSegment("/dashboard/admin/schedule", "/dashboard/catalog/album/4")).toBe(
      "/dashboard/admin/schedule",
    );
  });
});

describe("parseAlbumIdFromPathname", () => {
  it("extracts the open album id", () => {
    expect(parseAlbumIdFromPathname("/dashboard/catalog/album/42")).toBe(42);
    expect(parseAlbumIdFromPathname("/dashboard/flowsheet/album/7/")).toBe(7);
  });

  it("returns null when no album is open", () => {
    expect(parseAlbumIdFromPathname("/dashboard/catalog")).toBeNull();
    expect(parseAlbumIdFromPathname("/dashboard/catalog/album/abc")).toBeNull();
  });
});
