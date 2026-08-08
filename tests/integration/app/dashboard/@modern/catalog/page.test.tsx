import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

// Search and results aren't under test here; this page's own responsibility is
// which controls it offers in its header.
vi.mock("@/src/components/experiences/modern/catalog/Search/MobileSearchBar", () => ({
  default: () => null,
}));
vi.mock("@/src/components/experiences/modern/catalog/Search/SearchBar", () => ({
  default: () => null,
}));
vi.mock("@/src/components/experiences/modern/catalog/Results/Results", () => ({
  default: () => null,
}));

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

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import CatalogPage from "@/app/dashboard/@modern/catalog/page";

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

describe("catalog page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session());
  });

  // Both write surfaces have to be reachable from this page, and neither
  // component can assert that about itself. The add-release panel tells an MD
  // whose artist isn't filed under the chosen genre to add that artist first —
  // if the artist entry point stops being mounted, that sentence names a step
  // the product no longer offers, and every test that renders either panel
  // directly still passes.
  it("offers an MD both catalog write entry points", async () => {
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    renderWithProviders(<CatalogPage />);

    expect(
      await screen.findByRole("button", { name: /add artist/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /add release/i }),
    ).toBeInTheDocument();
  });

  it("offers a DJ neither", async () => {
    mockFetchOrgRole.mockResolvedValue("dj");
    renderWithProviders(<CatalogPage />);

    await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
    await mockFetchOrgRole.mock.results[0].value;

    expect(
      screen.queryByRole("button", { name: /add artist/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add release/i }),
    ).not.toBeInTheDocument();
  });
});
