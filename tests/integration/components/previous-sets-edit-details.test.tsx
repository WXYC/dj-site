import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { createTestV2TrackEntry } from "@/tests/fixtures/fixtures";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";
import { Authorization } from "@/lib/features/admin/types";
import { specialtyCopy } from "@/lib/features/specialty/copy";
import ModernShowView from "@/src/components/experiences/modern/previous-sets/ShowView";
import ClassicShowView from "@/src/components/experiences/classic/playlists/ShowView";

const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
vi.mock("@/src/hooks/authenticationHooks", async (importOriginal) => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return {
    ...(await importOriginal<typeof import("@/src/hooks/authenticationHooks")>()),
    ...createAuthenticationHookMock(mockAuth),
  };
});

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const SHOW_ID = 1951179;
const [ORANGE_COUNTY] = SEED_CATALOG;

function servePlaylist(over: { end_time: string | null; show_djs?: unknown[] }) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(SEED_CATALOG)),
    http.get(`${TEST_BACKEND_URL}/flowsheet/playlist`, () =>
      HttpResponse.json({
        id: SHOW_ID,
        show_name: "Pumpkin Spice Special",
        specialty: ORANGE_COUNTY,
        specialty_show_name: ORANGE_COUNTY.name,
        start_time: "2026-08-22T20:36:00.000Z",
        dj_name_override: null,
        legacy_dj_name: null,
        previous_show_id: null,
        next_show_id: null,
        show_djs: [],
        entries: [createTestV2TrackEntry({ id: 3001, show_id: SHOW_ID, play_order: 1 })],
        ...over,
      })
    )
  );
}

const ENDED = { end_time: "2026-08-23T00:01:00.000Z" };
const ON_AIR_WITH_ME = { end_time: null, show_djs: [{ id: "dj-me", dj_name: "Me" }] };

describe.each([
  ["modern", ModernShowView],
  ["classic", ClassicShowView],
])("%s Previous Sets show view: Edit show details", (_experience, ShowView) => {
  it.each([
    ["a music director on an ended show", Authorization.MD, ENDED, true],
    ["a station manager on an ended show", Authorization.SM, ENDED, true],
    ["a DJ on an ended show, even their own", Authorization.DJ, { ...ENDED, show_djs: ON_AIR_WITH_ME.show_djs }, false],
    ["a DJ on the show while it is on the air", Authorization.DJ, ON_AIR_WITH_ME, true],
    ["a DJ not on the show while it is on the air", Authorization.DJ, { end_time: null }, false],
  ])("for %s: offered %s", async (_who, authority, playlist, offered) => {
    mockAuth.authority = authority;
    servePlaylist(playlist);
    renderWithProviders(<ShowView showId={SHOW_ID} />);

    await screen.findAllByText(/\d{1,2}:\d{2}/);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: specialtyCopy.editDetails }) !== null
      ).toBe(offered)
    );
  });

  it("opens the dialog on the show's current program and title", async () => {
    mockAuth.authority = Authorization.MD;
    servePlaylist(ENDED);
    const { user } = renderWithProviders(<ShowView showId={SHOW_ID} />);

    await user.click(await screen.findByRole("button", { name: specialtyCopy.editDetails }));

    expect(await screen.findByRole("combobox", { name: /program/i })).toHaveTextContent(
      ORANGE_COUNTY.name
    );
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Pumpkin Spice Special");
  });
});
