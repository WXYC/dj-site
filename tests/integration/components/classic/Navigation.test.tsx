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

let currentPathname = "/dashboard/catalog";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
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
  currentPathname = "/dashboard/catalog";
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

      expect(screen.queryByText("Music Department")).not.toBeInTheDocument();
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
        expect(screen.getByText("Music Department")).toBeInTheDocument();
      });
      expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      expect(screen.getByText("Rotation")).toBeInTheDocument();
    });

    // The catalog entry point moved onto the Music Department menu under the
    // JSP's own label. Its invented bar label must not survive alongside it.
    it("no longer carries the invented Add/Modify Catalog label", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Music Department")).toBeInTheDocument();
      });
      expect(screen.queryByText("Add/Modify Catalog")).not.toBeInTheDocument();
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
      expect(screen.queryByText("Music Department")).not.toBeInTheDocument();
    });

    // Only one entry may be highlighted at a time. `isActive` matched every
    // link whose path prefixed the URL, so a library sub-screen lit both its
    // own entry and the catalog entry point at once; longest-match is what
    // makes the bar name a single location.
    describe("active highlighting", () => {
      const activeLabels = (container: HTMLElement) =>
        Array.from(container.querySelectorAll("a.active")).map((a) => a.textContent);

      it.each([
        { pathname: "/dashboard/library/missing", expected: "Missing Releases" },
        { pathname: "/dashboard/library", expected: "Music Department" },
        { pathname: "/dashboard/library/release/12", expected: "Music Department" },
        { pathname: "/dashboard/md", expected: "Music Department" },
        { pathname: "/dashboard/rotation", expected: "Rotation" },
        { pathname: "/dashboard/rotation/new", expected: "Rotation" },
        { pathname: "/dashboard/catalog", expected: "Card Catalog" },
      ])("highlights only $expected on $pathname", async ({ pathname, expected }) => {
        currentPathname = pathname;
        mockFetchOrgRole.mockResolvedValue("musicDirector");
        const { container } = renderWithProviders(<Navigation />);

        await waitFor(() => {
          expect(screen.getByText("Music Department")).toBeInTheDocument();
        });

        expect(activeLabels(container)).toEqual([expected]);
      });

      // A DJ has no Music Department entry, so the library screens claim
      // nothing in his bar rather than falling back to a neighbour.
      it("highlights nothing for a DJ on a library screen", async () => {
        currentPathname = "/dashboard/library/release/12";
        mockFetchOrgRole.mockResolvedValue("dj");
        const { container } = renderWithProviders(<Navigation />);

        await waitFor(() => {
          expect(screen.getByText("Missing Releases")).toBeInTheDocument();
        });

        expect(activeLabels(container)).toEqual([]);
      });
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
