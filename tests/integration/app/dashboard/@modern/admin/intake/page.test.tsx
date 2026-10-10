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

  // The forward carries no gate of its own: the target page runs the flag and role gates.
  it.each([
    [undefined, "dj"],
    ["false", "musicDirector"],
    ["staff", "dj"],
    ["staff", "musicDirector"],
    ["true", "dj"],
    ["true", "stationManager"],
  ] as const)("forwards to the music directors' tab when the flag is %s for a %s", async (flag, role) => {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_REVIEWS_ENABLED;
    else process.env.NEXT_PUBLIC_REVIEWS_ENABLED = flag;
    setUpClassicPageAuthority(role as ClassicPageRole);

    await assertDeniedClassicPage(() => IntakePage(), "/dashboard/reviews/music-directors");
  });
});
