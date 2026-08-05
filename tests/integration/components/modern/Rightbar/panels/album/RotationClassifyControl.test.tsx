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
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { rotationApi } from "@/lib/features/rotation/api";

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

const JUANA_MOLINA_ALBUM_ID = 4242;
const JUANA_MOLINA_ROTATION_ID = 900;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

/**
 * An album as the panel receives it. `GET /library/info` selects no rotation
 * columns, so no rotation fields are set here either — the control has to
 * learn rotation membership from the rotation list.
 */
const juanaMolinaAlbum = () =>
  createTestAlbum({
    id: JUANA_MOLINA_ALBUM_ID,
    title: "DOGA",
    artist: createTestArtist({
      name: "Juana Molina",
      lettercode: "MO",
      numbercode: 12,
      genre: "Rock",
    }),
    label: "Sonamos",
  });

/** A `GET /library/info` row: the library album with none of the rotation columns. */
const juanaMolinaLibraryInfoRow = () => ({
  id: JUANA_MOLINA_ALBUM_ID,
  artist_id: 77,
  genre_id: 2,
  format_id: 1,
  code_letters: "MO",
  code_artist_number: 12,
  code_number: 3,
  artist_name: "Juana Molina",
  alphabetical_name: "Juana Molina",
  album_title: "DOGA",
  label: "Sonamos",
  record_label: "Sonamos",
  format_name: "CD",
  genre_name: "Rock",
  plays: 4,
  add_date: "2026-07-01",
});

/**
 * A `GET /library/rotation` row. The backend projects `library.id` as `id`
 * and carries `rotation_id`/`rotation_bin` alongside it, which is the linkage
 * the control matches on.
 */
const juanaMolinaRotationRow = (rotationBin = "H") => ({
  id: JUANA_MOLINA_ALBUM_ID,
  code_letters: "MO",
  code_artist_number: 12,
  code_number: 3,
  artist_name: "Juana Molina",
  alphabetical_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  genre_name: "Rock",
  format_name: "CD",
  rotation_id: JUANA_MOLINA_ROTATION_ID,
  add_date: "2026-07-01",
  rotation_add_date: "2026-08-01",
  rotation_bin: rotationBin,
  rotation_kill_date: null,
  plays: 4,
});

type RotationRow = ReturnType<typeof juanaMolinaRotationRow>;

/**
 * Stateful stand-in for the rotation endpoints. The list is the source of
 * truth an add appends to and a kill removes from, so the control's state has
 * to travel back through `GET /library/rotation` exactly as it does in
 * production rather than being handed to it directly.
 *
 * The PATCH arm mirrors the backend's `isISODate` gate, which rejects
 * anything that isn't `YYYY-MM-DD` — a serialized JS `Date` included.
 */
function fakeRotationEndpoints(initial: RotationRow[] = []) {
  let rows = [...initial];
  const received: { add?: unknown; kill?: unknown } = {};
  let listRequests = 0;

  server.use(
    http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
      listRequests += 1;
      return HttpResponse.json(rows);
    }),
    http.post(`${TEST_BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as {
        album_id: number;
        rotation_bin: string;
      };
      received.add = body;
      rows = [...rows, juanaMolinaRotationRow(body.rotation_bin)];
      return HttpResponse.json(
        {
          id: JUANA_MOLINA_ROTATION_ID,
          album_id: body.album_id,
          rotation_bin: body.rotation_bin,
          add_date: "2026-08-05",
          kill_date: null,
        },
        { status: 201 },
      );
    }),
    http.patch(`${TEST_BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as {
        rotation_id: number;
        kill_date?: string;
      };
      received.kill = body;
      if (body.kill_date !== undefined && !ISO_DATE.test(body.kill_date)) {
        return HttpResponse.json(
          {
            error:
              "Bad Request, Incorrect Date Format: kill_date should be of form YYYY-MM-DD",
          },
          { status: 400 },
        );
      }
      const killed = rows.find((row) => row.rotation_id === body.rotation_id);
      rows = rows.filter((row) => row.rotation_id !== body.rotation_id);
      return HttpResponse.json({
        id: body.rotation_id,
        album_id: killed?.id ?? JUANA_MOLINA_ALBUM_ID,
        rotation_bin: killed?.rotation_bin ?? "H",
        add_date: "2026-08-01",
        kill_date: body.kill_date ?? "2026-08-05",
      });
    }),
  );

  return {
    addBody: () => received.add,
    killBody: () => received.kill,
    listRequests: () => listRequests,
  };
}

/** Sources the album the way the panel does, from `GET /library/info`. */
function AlbumPanelSection({ albumId }: { albumId: number }) {
  const { data } = useGetInformationQuery({ album_id: albumId });
  if (!data) return null;
  return <RotationClassifyControl album={data} />;
}

describe("RotationClassifyControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing and fetches no rotation list for a DJ", async () => {
      const backend = fakeRotationEndpoints([juanaMolinaRotationRow()]);
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByRole("radiogroup", { name: "Rotation bin" })).not.toBeInTheDocument()
      );
      expect(screen.queryByRole("button", { name: "Kill" })).not.toBeInTheDocument();
      expect(backend.listRequests()).toBe(0);
    });

    it("renders the bin picker for a Music Director", async () => {
      const backend = fakeRotationEndpoints();
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      expect(
        await screen.findByRole("radiogroup", { name: "Rotation bin" }),
      ).toBeInTheDocument();
      expect(backend.listRequests()).toBeGreaterThan(0);
    });
  });

  describe("add-to-rotation flow", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("has no active rotation entry: shows the bin picker, not a kill button", async () => {
      fakeRotationEndpoints();
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      await screen.findByRole("radiogroup", { name: "Rotation bin" });
      expect(screen.queryByRole("button", { name: "Kill" })).not.toBeInTheDocument();
    });

    it("POSTs album_id and the picked rotation_bin", async () => {
      const backend = fakeRotationEndpoints();
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("radiogroup", { name: "Rotation bin" });
      await user.click(screen.getByRole("radio", { name: "H" }));
      await user.click(screen.getByRole("button", { name: "Add to Rotation" }));

      await waitFor(() =>
        expect(backend.addBody()).toEqual({
          album_id: JUANA_MOLINA_ALBUM_ID,
          rotation_bin: "H",
        }),
      );
    });

    it("switches to the kill affordance once the entry appears in the rotation list", async () => {
      fakeRotationEndpoints();
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
      fakeRotationEndpoints();
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
      fakeRotationEndpoints([juanaMolinaRotationRow()]);
      renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      expect(await screen.findByRole("button", { name: "Kill" })).toBeInTheDocument();
      expect(
        screen.queryByRole("radiogroup", { name: "Rotation bin" }),
      ).not.toBeInTheDocument();
    });

    it("PATCHes the rotation_id alone, leaving kill_date to the server", async () => {
      const backend = fakeRotationEndpoints([juanaMolinaRotationRow()]);
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await user.click(await screen.findByRole("button", { name: "Kill" }));

      await waitFor(() =>
        expect(backend.killBody()).toEqual({
          rotation_id: JUANA_MOLINA_ROTATION_ID,
        }),
      );
    });

    it("rejects a kill_date that isn't a bare YYYY-MM-DD date", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()]);
      const { store } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      // The shape a JS `Date` takes once RTK Query serializes the body.
      const result = await store.dispatch(
        rotationApi.endpoints.killRotationEntry.initiate({
          rotation_id: JUANA_MOLINA_ROTATION_ID,
          kill_date: new Date("2026-08-06T02:30:00.000Z").toISOString(),
        }),
      );

      expect(result.error).toMatchObject({ status: 400 });
    });

    it("switches back to the bin picker once the entry leaves the rotation list", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()]);
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await user.click(await screen.findByRole("button", { name: "Kill" }));

      expect(
        await screen.findByRole("radiogroup", { name: "Rotation bin" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Kill" })).not.toBeInTheDocument();
    });

    it("shows an error toast when the PATCH fails", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()]);
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await user.click(await screen.findByRole("button", { name: "Kill" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Failed to kill rotation entry"),
      );
      expect(await screen.findByRole("button", { name: "Kill" })).toBeInTheDocument();
    });
  });

  describe("rotation state sourced from the live endpoints", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/info`, () =>
          HttpResponse.json(juanaMolinaLibraryInfoRow()),
        ),
      );
    });

    it("offers the kill affordance for an album the rotation list covers", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()]);
      renderWithProviders(
        inModernTheme(<AlbumPanelSection albumId={JUANA_MOLINA_ALBUM_ID} />),
      );

      expect(await screen.findByRole("button", { name: "Kill" })).toBeInTheDocument();
    });

    it("offers the bin picker for an album the rotation list doesn't cover", async () => {
      fakeRotationEndpoints([{ ...juanaMolinaRotationRow(), id: 5150, rotation_id: 901 }]);
      renderWithProviders(
        inModernTheme(<AlbumPanelSection albumId={JUANA_MOLINA_ALBUM_ID} />),
      );

      expect(
        await screen.findByRole("radiogroup", { name: "Rotation bin" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Kill" })).not.toBeInTheDocument();
    });
  });
});
