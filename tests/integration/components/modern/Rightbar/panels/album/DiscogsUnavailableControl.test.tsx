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

  // The global RTK Query middleware owns the wording for every shape it can
  // describe — a server-supplied reason, a transport failure, a body that
  // wasn't JSON — and this control stays out of those. What it must cover is
  // the shapes the middleware says nothing for, or the failure is silent.
  describe("every rejection shape leaves the MD exactly one message", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    async function toggleWith(respond: Parameters<typeof http.patch>[1]) {
      server.use(http.patch(`${TEST_BACKEND_URL}/library/:id`, respond));
      const { user } = renderWithProviders(
        <DiscogsUnavailableControl album={juanaMolinaAlbum()} />,
      );
      const toggle = await screen.findByLabelText("Not on Discogs");
      await user.click(toggle);
      await waitFor(() => expect(toggle).not.toBeChecked());
      return (toast.error as ReturnType<typeof vi.fn>).mock.calls.map(
        ([message]) => message,
      );
    }

    it("stays quiet when the server supplied its own reason", async () => {
      const messages = await toggleWith(() =>
        HttpResponse.json(
          { message: "Album is not catalogued" },
          { status: 400 },
        ),
      );

      expect(messages).toEqual(["Album is not catalogued"]);
    });

    it("speaks when the server rejects with no reason at all", async () => {
      const messages = await toggleWith(() => HttpResponse.json({}, { status: 500 }));

      expect(messages).toEqual(["Failed to update Discogs availability"]);
    });

    // A route answering a mutation with HTML (an Express 404 page, a gateway
    // 502) is the middleware's to word — asserted as "something, but not a
    // second toast from here", so improving that wording doesn't break this.
    it("leaves a non-JSON body to the middleware", async () => {
      const messages = await toggleWith(
        () =>
          new HttpResponse(
            "<!DOCTYPE html><html><body>Cannot PATCH /library/4242</body></html>",
            { status: 404, headers: { "Content-Type": "text/html" } },
          ),
      );

      expect(messages).toHaveLength(1);
      expect(messages).not.toContain("Failed to update Discogs availability");
    });

    it("leaves a request that never lands to the middleware", async () => {
      const messages = await toggleWith(() => HttpResponse.error());

      expect(messages).toEqual(["Network error — please check your connection."]);
    });

    // A 200 whose body the response transform can't read rejects the thunk
    // without a value, so the middleware never sees it and toasts nothing —
    // this fallback is all the MD gets.
    it("is the only message when the response transform throws", async () => {
      const messages = await toggleWith(() => HttpResponse.json(null));

      expect(messages).toEqual(["Failed to update Discogs availability"]);
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
