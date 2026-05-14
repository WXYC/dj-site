import { describe, it, expect } from "vitest";
import * as ClassicPlaylistsPageModule from "../page";

// The Classic Previous Sets page must NOT import from
// src/components/experiences/modern/ (per the tubafrenzy-sync plan PR 4).
describe("Classic /dashboard/playlists page", () => {
  it("exports a default React component", () => {
    expect(typeof ClassicPlaylistsPageModule.default).toBe("function");
  });

  it("has a Next.js Metadata export with the Previous Sets title", () => {
    expect(ClassicPlaylistsPageModule.metadata).toBeDefined();
    expect(ClassicPlaylistsPageModule.metadata.title).toMatch(
      /previous sets/i
    );
  });
});
