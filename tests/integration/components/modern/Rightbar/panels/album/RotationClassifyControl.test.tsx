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
import RotationClassifyControl from "@/src/components/experiences/modern/Rightbar/panels/album/RotationClassifyControl";

// Mock fonts before importing the modern theme (pulled in for the rotation palette).
vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";
import modernTheme from "@/lib/features/experiences/modern/theme";

// The bin colors come from the custom `rotation` palette slot, which only
// resolves under the modern theme (see RotationEntryFields.test for the pattern).
const inModernTheme = (ui: ReactElement) => (
  <CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>
);

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

function mockAdd() {
  let receivedBody: unknown;
  server.use(
    http.post(`${TEST_BACKEND_URL}/library/rotation`, async ({ request }) => {
      receivedBody = await request.json();
      return HttpResponse.json({
        id: 900,
        album_id: 4242,
        rotation_bin: "H",
        add_date: "2026-08-05",
        kill_date: null,
        ...(receivedBody as Record<string, unknown>),
      });
    }),
  );
  return () => receivedBody;
}

function mockKill() {
  let receivedBody: unknown;
  server.use(
    http.patch(`${TEST_BACKEND_URL}/library/rotation`, async ({ request }) => {
      receivedBody = await request.json();
      return HttpResponse.json({
        id: 900,
        album_id: 4242,
        rotation_bin: "H",
        add_date: "2026-08-05",
        kill_date: "2026-08-05",
      });
    }),
  );
  return () => receivedBody;
}

describe("RotationClassifyControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByRole("radiogroup", { name: "Rotation bin" })).not.toBeInTheDocument()
      );
    });

    it("renders the bin picker for a Music Director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      expect(
        await screen.findByRole("radiogroup", { name: "Rotation bin" }),
      ).toBeInTheDocument();
    });
  });

  describe("add-to-rotation flow", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("has no active rotation entry: shows the bin picker, not a kill button", async () => {
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      await screen.findByRole("radiogroup", { name: "Rotation bin" });
      expect(screen.queryByRole("button", { name: "Kill" })).not.toBeInTheDocument();
    });

    it("POSTs album_id and the picked rotation_bin", async () => {
      const getReceivedBody = mockAdd();
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("radiogroup", { name: "Rotation bin" });
      await user.click(screen.getByRole("radio", { name: "H" }));
      await user.click(screen.getByRole("button", { name: "Add to Rotation" }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          album_id: 4242,
          rotation_bin: "H",
        }),
      );
    });

    it("switches to the kill affordance once the album is added", async () => {
      mockAdd();
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("radiogroup", { name: "Rotation bin" });
      await user.click(screen.getByRole("radio", { name: "H" }));
      await user.click(screen.getByRole("button", { name: "Add to Rotation" }));

      expect(await screen.findByRole("button", { name: "Kill" })).toBeInTheDocument();
      expect(
        screen.queryByRole("radiogroup", { name: "Rotation bin" }),
      ).not.toBeInTheDocument();
    });

    it("shows an error toast when the POST fails", async () => {
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("radiogroup", { name: "Rotation bin" });
      await user.click(screen.getByRole("radio", { name: "M" }));
      await user.click(screen.getByRole("button", { name: "Add to Rotation" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Failed to add to rotation"),
      );
      expect(
        await screen.findByRole("radiogroup", { name: "Rotation bin" }),
      ).toBeInTheDocument();
    });
  });

  describe("kill-rotation flow", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("has an active rotation entry: shows the kill button, not the bin picker", async () => {
      renderWithProviders(
        inModernTheme(
          <RotationClassifyControl
            album={juanaMolinaAlbum({ rotation_id: 900, rotation_bin: "H" as never })}
          />,
        ),
      );

      expect(await screen.findByRole("button", { name: "Kill" })).toBeInTheDocument();
      expect(
        screen.queryByRole("radiogroup", { name: "Rotation bin" }),
      ).not.toBeInTheDocument();
    });

    it("PATCHes the rotation_id from the active entry", async () => {
      const getReceivedBody = mockKill();
      const { user } = renderWithProviders(
        inModernTheme(
          <RotationClassifyControl
            album={juanaMolinaAlbum({ rotation_id: 900, rotation_bin: "H" as never })}
          />,
        ),
      );

      await user.click(await screen.findByRole("button", { name: "Kill" }));

      await waitFor(() => {
        const body = getReceivedBody() as Record<string, unknown>;
        expect(body.rotation_id).toBe(900);
        expect(typeof body.kill_date).toBe("string");
      });
    });

    it("switches back to the bin picker once the entry is killed", async () => {
      mockKill();
      const { user } = renderWithProviders(
        inModernTheme(
          <RotationClassifyControl
            album={juanaMolinaAlbum({ rotation_id: 900, rotation_bin: "H" as never })}
          />,
        ),
      );

      await user.click(await screen.findByRole("button", { name: "Kill" }));

      expect(
        await screen.findByRole("radiogroup", { name: "Rotation bin" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Kill" })).not.toBeInTheDocument();
    });

    it("shows an error toast when the PATCH fails", async () => {
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        inModernTheme(
          <RotationClassifyControl
            album={juanaMolinaAlbum({ rotation_id: 900, rotation_bin: "H" as never })}
          />,
        ),
      );

      await user.click(await screen.findByRole("button", { name: "Kill" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Failed to kill rotation entry"),
      );
      expect(await screen.findByRole("button", { name: "Kill" })).toBeInTheDocument();
    });
  });
});
