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

// No organization configured (the real production shape): the WXYC tier
// resolves via fetchOrganizationRoleForUserClient's JWT decode, not the raw
// session role, so every test drives that mock and awaits resolution.
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
import { toast } from "sonner";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

// session.user.role is better-auth's admin-plugin column (null in
// production for ordinary members) — it is never the WXYC tier. Callers must
// also set mockFetchOrgRole to the intended tier; this only builds the
// session shape.
function sessionWithRole() {
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
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      // Wait for the org-role fetch to actually settle (not just have been
      // called) before asserting the negative, so this doesn't pass vacuously
      // while resolution is still pending.
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByLabelText("Not on Discogs")).not.toBeInTheDocument()
      );
    });

    it("renders the toggle for a Music Director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      expect(await screen.findByLabelText("Not on Discogs")).toBeInTheDocument();
    });

    it("renders the toggle for a Station Manager", async () => {
      mockFetchOrgRole.mockResolvedValue("stationManager");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      expect(await screen.findByLabelText("Not on Discogs")).toBeInTheDocument();
    });
  });

  describe("initial state", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("is unchecked with no note field when the album is not flagged", async () => {
      renderWithProviders(<DiscogsUnavailableControl album={juanaMolinaAlbum()} />);

      expect(await screen.findByLabelText("Not on Discogs")).not.toBeChecked();
      expect(screen.queryByLabelText("Reason (optional)")).not.toBeInTheDocument();
    });

    it("is checked with the note prefilled when the album is already flagged", async () => {
      renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({
            discogsUnavailable: true,
            discogsUnavailableNote: "audience doesn't use Discogs",
          })}
        />,
      );

      expect(await screen.findByLabelText("Not on Discogs")).toBeChecked();
      expect(screen.getByLabelText("Reason (optional)")).toHaveValue(
        "audience doesn't use Discogs",
      );
    });

    it("caps the note field at 500 characters", async () => {
      renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true })}
        />,
      );

      expect(await screen.findByLabelText("Reason (optional)")).toHaveAttribute(
        "maxLength",
        "500",
      );
    });
  });

  describe("toggling the flag", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("PATCHes the flag and optimistically reflects the just-set value", async () => {
      const getReceivedBody = mockPatch();
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl album={juanaMolinaAlbum()} />,
      );

      const toggle = await screen.findByLabelText("Not on Discogs");
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

      const toggle = await screen.findByLabelText("Not on Discogs");
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

      const toggle = await screen.findByLabelText("Not on Discogs");
      await user.click(toggle);

      await waitFor(() => expect(toggle).not.toBeChecked());
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to update Discogs availability",
      );
    });
  });

  describe("editing the note", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("does not show a Save button until the note text changes", async () => {
      renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true, discogsUnavailableNote: "old reason" })}
        />,
      );

      await screen.findByLabelText("Reason (optional)");
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    });

    it("saves the trimmed note via PATCH", async () => {
      const getReceivedBody = mockPatch();
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl
          album={juanaMolinaAlbum({ discogsUnavailable: true, discogsUnavailableNote: "old reason" })}
        />,
      );

      const note = await screen.findByLabelText("Reason (optional)");
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

      const note = await screen.findByLabelText("Reason (optional)");
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

      const note = await screen.findByLabelText("Reason (optional)");
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

      const note = await screen.findByLabelText("Reason (optional)");
      await user.type(note, " updated");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to save note"));
    });
  });
});
