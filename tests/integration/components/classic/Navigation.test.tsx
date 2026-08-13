import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

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

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: () => ({ handleLogout: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/catalog",
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import Navigation from "@/src/components/experiences/classic/Navigation";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

const FLAG = "NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED";

function session() {
  return {
    data: {
      user: {
        id: "user-1",
        email: "librarian@wxyc.org",
        name: "Test Librarian",
        username: "librarian",
        role: null,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
    },
    isPending: false,
  };
}

beforeEach(() => {
  mockUseSession.mockReturnValue(session());
  mockFetchOrgRole.mockResolvedValue("dj");
});

afterEach(() => {
  delete process.env[FLAG];
  vi.clearAllMocks();
});

describe("classic Navigation", () => {
  it("always renders the DJ links", async () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByText("Card Catalog")).toBeInTheDocument();
    expect(screen.getByText("Flowsheet")).toBeInTheDocument();
    expect(screen.getByText("Previous Sets")).toBeInTheDocument();
    expect(screen.getByText("Log Out")).toBeInTheDocument();
  });

  describe("with the librarian nav flag off", () => {
    it("hides the librarian links even from a music director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Card Catalog")).toBeInTheDocument();
      });

      expect(screen.queryByText("Add/Modify Catalog")).not.toBeInTheDocument();
      expect(screen.queryByText("Missing Releases")).not.toBeInTheDocument();
      expect(screen.queryByText("Rotation")).not.toBeInTheDocument();
    });
  });

  describe("with the librarian nav flag on", () => {
    beforeEach(() => {
      process.env[FLAG] = "true";
    });

    it("shows every librarian link to a music director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Add/Modify Catalog")).toBeInTheDocument();
      });
      expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      expect(screen.getByText("Rotation")).toBeInTheDocument();
    });

    // Marking a release missing or found is deliberately DJ-accessible, and so
    // is reading the rotation list — both sit outside tubafrenzy's admin check.
    it("shows missing releases and rotation to a plain DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      });
      expect(screen.getByText("Rotation")).toBeInTheDocument();
    });

    it("hides the catalog edit entry point from a plain DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      });
      expect(screen.queryByText("Add/Modify Catalog")).not.toBeInTheDocument();
    });

    it("leaves no empty list item behind when a link is withheld", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      const { container } = renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      });

      const empty = Array.from(container.querySelectorAll("li")).filter(
        (item) => item.textContent?.trim() === ""
      );
      expect(empty).toHaveLength(0);
    });
  });
});
