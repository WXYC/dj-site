import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import LibraryStatus from "@/src/components/experiences/modern/Rightbar/panels/album/LibraryStatus";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// No organization configured: AuthorizedView falls back to the raw session
// role synchronously, so tests don't need to await an org-role fetch.
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

import { authClient } from "@/lib/features/authentication/client";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;

function sessionWithRole(role: string) {
  return {
    data: {
      user: {
        id: "user-1",
        email: "test@wxyc.org",
        name: "Test User",
        username: "testuser",
        role,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
    },
    isPending: false,
    error: null,
  };
}

function noSession() {
  return { data: null, isPending: false, error: null };
}

const catPowerAlbum = () =>
  createTestAlbum({
    title: "Moon Pix",
    artist: createTestArtist({
      name: "Cat Power",
      lettercode: "RO",
      numbercode: 23,
      genre: "Rock",
    }),
    label: "Matador Records",
  });

describe("LibraryStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("shows the Mark Missing action for a Music Director", () => {
      mockUseSession.mockReturnValue(sessionWithRole("musicDirector"));

      renderWithProviders(<LibraryStatus album={catPowerAlbum()} />);

      expect(screen.getByText("In Library")).toBeInTheDocument();
      expect(screen.getByText("Mark Missing")).toBeInTheDocument();
    });

    it("shows the status chip but hides the Mark Missing action for a DJ", () => {
      mockUseSession.mockReturnValue(sessionWithRole("dj"));

      renderWithProviders(<LibraryStatus album={catPowerAlbum()} />);

      expect(screen.getByText("In Library")).toBeInTheDocument();
      expect(screen.queryByText("Mark Missing")).not.toBeInTheDocument();
    });

    it("shows the status chip but hides the Mark Found action for an unresolved session", () => {
      mockUseSession.mockReturnValue(noSession());
      const album = catPowerAlbum();
      album.date_lost = "2025-03-15";

      renderWithProviders(<LibraryStatus album={album} />);

      expect(
        screen.getByText(
          `Missing since ${new Date("2025-03-15").toLocaleDateString()}`,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Mark Found")).not.toBeInTheDocument();
    });

    it("shows the Mark Found action for a Station Manager", () => {
      mockUseSession.mockReturnValue(sessionWithRole("stationManager"));
      const album = catPowerAlbum();
      album.date_lost = "2025-03-15";

      renderWithProviders(<LibraryStatus album={album} />);

      expect(screen.getByText("Mark Found")).toBeInTheDocument();
    });
  });

  describe("status display", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(sessionWithRole("musicDirector"));
    });

    it("shows 'In Library' chip when date_lost is undefined", () => {
      const album = catPowerAlbum();

      renderWithProviders(<LibraryStatus album={album} />);

      expect(screen.getByText("In Library")).toBeInTheDocument();
      expect(screen.getByText("Mark Missing")).toBeInTheDocument();
    });

    it("shows 'Missing since...' chip when date_lost is set and date_found is not", () => {
      const album = catPowerAlbum();
      album.date_lost = "2025-03-15";

      renderWithProviders(<LibraryStatus album={album} />);

      expect(
        screen.getByText(
          `Missing since ${new Date("2025-03-15").toLocaleDateString()}`,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Mark Found")).toBeInTheDocument();
    });

    it("shows 'In Library' when date_found is after date_lost", () => {
      const album = catPowerAlbum();
      album.date_lost = "2025-03-15";
      album.date_found = "2025-04-01";

      renderWithProviders(<LibraryStatus album={album} />);

      expect(screen.getByText("In Library")).toBeInTheDocument();
      expect(screen.getByText("Mark Missing")).toBeInTheDocument();
    });

    it("shows missing when date_found is before date_lost", () => {
      const album = catPowerAlbum();
      album.date_lost = "2025-04-10";
      album.date_found = "2025-03-01";

      renderWithProviders(<LibraryStatus album={album} />);

      expect(
        screen.getByText(
          `Missing since ${new Date("2025-04-10").toLocaleDateString()}`,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Mark Found")).toBeInTheDocument();
    });
  });
});
