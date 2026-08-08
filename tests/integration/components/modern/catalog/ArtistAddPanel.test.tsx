import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/tests/helpers";
import { server } from "@/tests/fakes/server";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import ArtistAddPanel from "@/src/components/experiences/modern/catalog/ArtistAddPanel";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

function session() {
  return {
    data: {
      user: {
        id: "user-1",
        email: "test@wxyc.org",
        name: "Test User",
        username: "testuser",
        role: null,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
    },
    isPending: false,
  };
}

describe("ArtistAddPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session());
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
        HttpResponse.json([{ id: 7, genre_name: "Rock" }]),
      ),
    );
  });

  // The add-release panel tells an MD whose artist isn't filed under the
  // chosen genre to add that artist first. This entry point is what makes
  // that instruction followable — without it the form exists but nothing
  // renders it, and the release cannot be filed at all.
  it("opens the artist-add form from the catalog header", async () => {
    const { user } = renderWithProviders(<ArtistAddPanel />);

    const trigger = await screen.findByRole("button", { name: /add artist/i });
    expect(
      screen.queryByPlaceholderText("Search artists..."),
    ).not.toBeInTheDocument();

    await user.click(trigger);

    expect(
      await screen.findByPlaceholderText("Search artists..."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Code number")).toBeInTheDocument();
  });

  it("stays shut for a DJ", async () => {
    mockFetchOrgRole.mockResolvedValue("dj");
    renderWithProviders(<ArtistAddPanel />);

    await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: /add artist/i }),
    ).not.toBeInTheDocument();
  });
});
