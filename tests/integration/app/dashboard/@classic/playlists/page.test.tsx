import { describe, it, expect, vi } from "vitest";

// The page is a Server Component and pulls in the seed fetcher, which guards
// itself with `server-only`. That guard throws under the client-shaped test
// environment, so it is stubbed here exactly as the seed's own unit test does.
vi.mock("server-only", () => ({}));

import * as ClassicPlaylistsPageModule from "@/app/dashboard/@classic/playlists/page";

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
