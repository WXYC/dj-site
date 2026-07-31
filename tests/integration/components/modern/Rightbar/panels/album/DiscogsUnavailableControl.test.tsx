import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import DiscogsUnavailableControl from "@/src/components/experiences/modern/Rightbar/panels/album/DiscogsUnavailableControl";

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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { authClient } from "@/lib/features/authentication/client";
import { toast } from "sonner";

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

const juanaMolinaAlbum = (overrides: Parameters<typeof createTestAlbum>[0] = {}) =>
  createTestAlbum({
    id: 4242,
    title: "DOGA",
    artist: createTestArtist({
      name: "Juana Molina",
      lettercode: "MO",
      numbercode: 12,
      genre: "Rock",
    }),
    label: "Sonamos",
    ...overrides,
  });

function mockPatch() {
  let receivedBody: unknown;
  server.use(
    http.patch(`${TEST_BACKEND_URL}/library/:id`, async ({ request }) => {
      receivedBody = await request.json();
      return HttpResponse.json({
        id: 4242,
        album_title: "DOGA",
        artist_name: "Juana Molina",
        code_letters: "MO",
        code_number: 1,
        code_artist_number: 12,
        format_name: "CD",
        genre_name: "Rock",
        label: "Sonamos",
        ...(receivedBody as Record<string, unknown>),
      });
    }),
  );
  return () => receivedBody;
}

describe("DiscogsUnavailableControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", () => {
      mockUseSession.mockReturnValue(sessionWithRole("dj"));
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      expect(screen.queryByLabelText("Not on Discogs")).not.toBeInTheDocument();
    });

    it("renders the toggle for a Music Director", () => {
      mockUseSession.mockReturnValue(sessionWithRole("musicDirector"));
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      expect(screen.getByLabelText("Not on Discogs")).toBeInTheDocument();
    });

    it("renders the toggle for a Station Manager", () => {
      mockUseSession.mockReturnValue(sessionWithRole("stationManager"));
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      expect(screen.getByLabelText("Not on Discogs")).toBeInTheDocument();
    });
  });

  describe("initial state", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(sessionWithRole("musicDirector"));
    });

    it("is unchecked with no note field when the album is not flagged", () => {
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      expect(screen.getByLabelText("Not on Discogs")).not.toBeChecked();
      expect(screen.queryByLabelText("Reason (optional)")).not.toBeInTheDocument();
    });

    it("is checked with the note prefilled when the album is already flagged", () => {
      renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({
            discogsUnavailable: true,
            discogsUnavailableNote: "audience doesn't use Discogs",
          })}
        />,
      );

      expect(screen.getByLabelText("Not on Discogs")).toBeChecked();
      expect(screen.getByLabelText("Reason (optional)")).toHaveValue(
        "audience doesn't use Discogs",
      );
    });

    it("caps the note field at 500 characters", () => {
      renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true })}
        />,
      );

      expect(screen.getByLabelText("Reason (optional)")).toHaveAttribute(
        "maxLength",
        "500",
      );
    });
  });

  describe("toggling the flag", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(sessionWithRole("musicDirector"));
    });

    it("PATCHes the flag and optimistically reflects the just-set value", async () => {
      const getReceivedBody = mockPatch();
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl album={juanaMolinaAlbum()} />,
      );

      const toggle = screen.getByLabelText("Not on Discogs");
      await user.click(toggle);

      // Reflected immediately, ahead of the PATCH resolving.
      expect(toggle).toBeChecked();
      expect(screen.getByLabelText("Reason (optional)")).toBeInTheDocument();

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          discogsUnavailable: true,
          discogsUnavailableNote: null,
        }),
      );
    });

    it("sends null for the note (flag <-> note invariant) when turning the flag off", async () => {
      const getReceivedBody = mockPatch();
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({
            discogsUnavailable: true,
            discogsUnavailableNote: "embargoed until 2026-09-01",
          })}
        />,
      );

      const toggle = screen.getByLabelText("Not on Discogs");
      await user.click(toggle);

      expect(toggle).not.toBeChecked();
      expect(screen.queryByLabelText("Reason (optional)")).not.toBeInTheDocument();

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          discogsUnavailable: false,
          discogsUnavailableNote: null,
        }),
      );
    });

    it("reverts the toggle and shows an error toast when the PATCH fails", async () => {
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/:id`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl album={juanaMolinaAlbum()} />,
      );

      const toggle = screen.getByLabelText("Not on Discogs");
      await user.click(toggle);

      await waitFor(() => expect(toggle).not.toBeChecked());
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to update Discogs availability",
      );
    });
  });

  describe("editing the note", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(sessionWithRole("musicDirector"));
    });

    it("does not show a Save button until the note text changes", () => {
      renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true, discogsUnavailableNote: "old reason" })}
        />,
      );

      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });

    it("saves the trimmed note via PATCH", async () => {
      const getReceivedBody = mockPatch();
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true, discogsUnavailableNote: "old reason" })}
        />,
      );

      const note = screen.getByLabelText("Reason (optional)");
      await user.clear(note);
      await user.type(note, "  new reason  ");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          discogsUnavailable: true,
          discogsUnavailableNote: "new reason",
        }),
      );
    });

    it("saves an empty note as null", async () => {
      const getReceivedBody = mockPatch();
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true, discogsUnavailableNote: "old reason" })}
        />,
      );

      const note = screen.getByLabelText("Reason (optional)");
      await user.clear(note);
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          discogsUnavailable: true,
          discogsUnavailableNote: null,
        }),
      );
    });

    it("hides the Save button again after a successful save", async () => {
      mockPatch();
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true, discogsUnavailableNote: "old reason" })}
        />,
      );

      const note = screen.getByLabelText("Reason (optional)");
      await user.clear(note);
      await user.type(note, "new reason");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument(),
      );
    });

    it("shows an error toast when saving the note fails", async () => {
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/:id`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true, discogsUnavailableNote: "old reason" })}
        />,
      );

      const note = screen.getByLabelText("Reason (optional)");
      await user.type(note, " updated");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to save note"));
    });
  });
});
