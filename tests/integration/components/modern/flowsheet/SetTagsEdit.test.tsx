import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import SetTags from "@/src/components/experiences/modern/flowsheet/SetTags";
import { specialtyCopy } from "@/lib/features/specialty/copy";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

const mockLive = vi.hoisted(() => ({ live: true }));
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useLiveStatus: () => ({ live: mockLive.live }),
}));

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

const ORANGE_COUNTY = SEED_CATALOG[0];

function serve(specialty: typeof ORANGE_COUNTY | null) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(SEED_CATALOG)),
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json({
        entries: [],
        page: 0,
        limit: 1,
        total: 0,
        total_pages: 1,
        on_air: { dj_name: "DJ Test", show_id: 7 },
        shows: [{ id: 7, start_time: "2026-10-18T16:30:00Z", specialty, show_name: "Pumpkin" }],
      })
    )
  );
}

describe("SetTags edit entry point", () => {
  it.each([
    ["the Freeform chip", null, specialtyCopy.freeform],
    ["the program name", ORANGE_COUNTY, ORANGE_COUNTY.name],
  ])("opens the dialog from %s for a DJ on the show", async (_what, specialty, label) => {
    mockLive.live = true;
    serve(specialty);
    const { user } = renderWithProviders(<SetTags />);

    await user.click(await screen.findByRole("button", { name: new RegExp(label) }));

    expect(await screen.findByText(specialtyCopy.editDetailsTitle)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Pumpkin");
  });

  it.each([
    ["the Freeform chip", null, specialtyCopy.freeform],
    ["the program name", ORANGE_COUNTY, ORANGE_COUNTY.name],
  ])("renders %s without a button for a DJ not on the show", async (_what, specialty, label) => {
    mockLive.live = false;
    serve(specialty);
    renderWithProviders(<SetTags />);

    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
