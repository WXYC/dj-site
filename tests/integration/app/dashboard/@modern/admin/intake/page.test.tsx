import { describe, it, vi } from "vitest";
import {
  setUpClassicPageAuthority,
  setUpClassicPageAuthorityEnv,
  assertDeniedClassicPage,
  type ClassicPageRole,
} from "@/tests/helpers/classic-page-authority-harness";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async () => {
  const { classicPageAuthorityNavigationMock } = await import("@/tests/helpers/classic-page-authority-harness");
  return classicPageAuthorityNavigationMock();
});

import IntakePage from "@/app/dashboard/@modern/admin/intake/page";

describe("review shelf admin page", () => {
  setUpClassicPageAuthorityEnv();

  // The forward carries no gate of its own: the target page runs the access and role gates.
  it.each(["dj", "musicDirector", "stationManager"] as const)("forwards a %s to the music directors' tab", async (role) => {
    setUpClassicPageAuthority(role as ClassicPageRole);

    await assertDeniedClassicPage(() => IntakePage(), "/dashboard/reviews/music-directors");
  });

});
