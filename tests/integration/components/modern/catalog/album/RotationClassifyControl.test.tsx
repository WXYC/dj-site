import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
  server,
  TEST_BACKEND_URL,
  fakeRotationEndpoints,
  fakeRotationEndpointsWithGatedKill,
} from "@/tests/helpers";
import RotationClassifyControl from "@/src/components/experiences/modern/catalog/album/RotationClassifyControl";

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
// A second active entry for the same album, in a different bin — the
// re-binned-without-a-kill case `getRotationFromDB`'s DISTINCT ON surfaces
// as more than one row.
const JUANA_MOLINA_SECOND_ROTATION_ID = 901;

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


const buildJuanaMolinaRow = (rotationBin: string) => juanaMolinaRotationRow(rotationBin);

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
      const backend = fakeRotationEndpoints([juanaMolinaRotationRow()], {
        buildRow: buildJuanaMolinaRow,
      });
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByRole("group", { name: "Rotation bin" })).not.toBeInTheDocument()
      );
      expect(screen.queryByRole("button", { name: "Kill H" })).not.toBeInTheDocument();
      expect(backend.listRequests()).toBe(0);
    });

    it("renders the bin picker for a Music Director", async () => {
      const backend = fakeRotationEndpoints([], { buildRow: buildJuanaMolinaRow });
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      expect(
        await screen.findByRole("group", { name: "Rotation bin" }),
      ).toBeInTheDocument();
      expect(backend.listRequests()).toBeGreaterThan(0);
    });
  });

  describe("set-rotation flow", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("has no active rotation entry: shows the bin picker, not a kill button", async () => {
      fakeRotationEndpoints([], { buildRow: buildJuanaMolinaRow });
      renderWithProviders(inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />));

      await screen.findByRole("group", { name: "Rotation bin" });
      expect(screen.queryByRole("button", { name: "Kill H" })).not.toBeInTheDocument();
    });

    it("POSTs album_id and the picked rotation_bin", async () => {
      const backend = fakeRotationEndpoints([], { buildRow: buildJuanaMolinaRow });
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("group", { name: "Rotation bin" });
      await user.click(screen.getByRole("checkbox", { name: "Heavy rotation" }));
      await user.click(screen.getByRole("button", { name: "Set Rotation" }));

      await waitFor(() =>
        expect(backend.addBody()).toEqual({
          album_id: JUANA_MOLINA_ALBUM_ID,
          rotation_bin: "H",
        }),
      );
    });

    // The control's headline behavior. Without this the wiring is only covered
    // by the hook's own unit test, so passing `[]` instead of `activeEntries`
    // from this surface would leave every test in this file green while
    // re-binning silently stacked a second bin.
    it("retires the album's active entry when a different bin is picked", async () => {
      const backend = fakeRotationEndpoints([juanaMolinaRotationRow("H")], {
        buildRow: buildJuanaMolinaRow,
      });
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("group", { name: "Rotation bin" });
      await user.click(screen.getByRole("checkbox", { name: "Medium rotation" }));
      await user.click(screen.getByRole("button", { name: "Set Rotation" }));

      await waitFor(() =>
        expect(backend.addBody()).toEqual({
          album_id: JUANA_MOLINA_ALBUM_ID,
          rotation_bin: "M",
        }),
      );
      await waitFor(() =>
        expect(backend.killBodies()).toEqual([
          { rotation_id: JUANA_MOLINA_ROTATION_ID },
        ]),
      );
    });

    // Retiring first and then failing the add would drop the album out of
    // rotation altogether -- invisible behind a generic error, and it also
    // removes the album from the flowsheet picker DJs use on air.
    it("leaves the existing bin in place when the add fails", async () => {
      const backend = fakeRotationEndpoints([juanaMolinaRotationRow("H")], {
        buildRow: buildJuanaMolinaRow,
      });
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "boom" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("group", { name: "Rotation bin" });
      await user.click(screen.getByRole("checkbox", { name: "Medium rotation" }));
      await user.click(screen.getByRole("button", { name: "Set Rotation" }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Kill H" })).toBeInTheDocument(),
      );
      expect(backend.killBodies()).toEqual([]);
      // The pick survives so the retry is one click, not a re-open of the picker.
      expect(screen.getByRole("checkbox", { name: "Medium rotation" })).toBeChecked();
    });

    it("adds the kill affordance once the entry appears in the rotation list, alongside the picker for re-binning", async () => {
      fakeRotationEndpoints([], { buildRow: buildJuanaMolinaRow });
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("group", { name: "Rotation bin" });
      await user.click(screen.getByRole("checkbox", { name: "Heavy rotation" }));
      await user.click(screen.getByRole("button", { name: "Set Rotation" }));

      expect(await screen.findByRole("button", { name: "Kill H" })).toBeInTheDocument();
      // The picker stays up so re-binning is a single gesture — it isn't
      // replaced by the kill affordance the way an XOR toggle would.
      expect(screen.getByRole("group", { name: "Rotation bin" })).toBeInTheDocument();
    });

    it("shows an error toast when the POST fails", async () => {
      fakeRotationEndpoints([], { buildRow: buildJuanaMolinaRow });
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("group", { name: "Rotation bin" });
      await user.click(screen.getByRole("checkbox", { name: "Medium rotation" }));
      await user.click(screen.getByRole("button", { name: "Set Rotation" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Could not update rotation."),
      );
      expect(
        await screen.findByRole("group", { name: "Rotation bin" }),
      ).toBeInTheDocument();
    });

    // A route answering a mutation with HTML (an Express 404 page, a gateway
    // 502) is the global middleware's to word: it toasts its own
    // plain-language PARSING_ERROR line, and this control must not stack a
    // vaguer second toast on top of it.
    it("leaves a non-JSON POST response to the middleware", async () => {
      fakeRotationEndpoints([], { buildRow: buildJuanaMolinaRow });
      server.use(
        http.post(
          `${TEST_BACKEND_URL}/library/rotation`,
          () =>
            new HttpResponse(
              "<!DOCTYPE html><html><body>Cannot POST /library/rotation</body></html>",
              { status: 404, headers: { "Content-Type": "text/html" } },
            ),
        ),
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByRole("group", { name: "Rotation bin" });
      await user.click(screen.getByRole("checkbox", { name: "Medium rotation" }));
      await user.click(screen.getByRole("button", { name: "Set Rotation" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Server returned an unexpected response — please try again.",
        ),
      );
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("kill-rotation flow", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("has an active rotation entry: shows the kill button alongside the picker", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()], { buildRow: buildJuanaMolinaRow });
      renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      expect(await screen.findByRole("button", { name: "Kill H" })).toBeInTheDocument();
      // Re-binning goes through the picker without killing first, so it stays present.
      expect(screen.getByRole("group", { name: "Rotation bin" })).toBeInTheDocument();
    });

    it("PATCHes the rotation_id alone, leaving kill_date to the server", async () => {
      const backend = fakeRotationEndpoints([juanaMolinaRotationRow()], {
        buildRow: buildJuanaMolinaRow,
      });
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await user.click(await screen.findByRole("button", { name: "Kill H" }));

      await waitFor(() =>
        expect(backend.killBodies()).toEqual([
          { rotation_id: JUANA_MOLINA_ROTATION_ID },
        ]),
      );
    });

    it("rejects a kill_date that isn't a bare YYYY-MM-DD date", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()], { buildRow: buildJuanaMolinaRow });
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

    it("keeps only the bin picker once the entry leaves the rotation list", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()], { buildRow: buildJuanaMolinaRow });
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await user.click(await screen.findByRole("button", { name: "Kill H" }));

      expect(
        await screen.findByRole("group", { name: "Rotation bin" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Kill H" })).not.toBeInTheDocument();
    });

    it("shows an error toast when the PATCH fails", async () => {
      fakeRotationEndpoints([juanaMolinaRotationRow()], { buildRow: buildJuanaMolinaRow });
      server.use(
        http.patch(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await user.click(await screen.findByRole("button", { name: "Kill H" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Could not update rotation."),
      );
      expect(await screen.findByRole("button", { name: "Kill H" })).toBeInTheDocument();
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
      fakeRotationEndpoints([juanaMolinaRotationRow()], { buildRow: buildJuanaMolinaRow });
      renderWithProviders(
        inModernTheme(<AlbumPanelSection albumId={JUANA_MOLINA_ALBUM_ID} />),
      );

      expect(await screen.findByRole("button", { name: "Kill H" })).toBeInTheDocument();
    });

    it("offers the bin picker for an album the rotation list doesn't cover", async () => {
      fakeRotationEndpoints([{ ...juanaMolinaRotationRow(), id: 5150, rotation_id: 901 }], {
        buildRow: buildJuanaMolinaRow,
      });
      renderWithProviders(
        inModernTheme(<AlbumPanelSection albumId={JUANA_MOLINA_ALBUM_ID} />),
      );

      expect(
        await screen.findByRole("group", { name: "Rotation bin" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Kill H" })).not.toBeInTheDocument();
    });
  });

  describe("an album active in more than one rotation bin", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("surfaces every active bin instead of silently acting on the alphabetically-lowest one", async () => {
      fakeRotationEndpoints(
        [
          juanaMolinaRotationRow("H"),
          { ...juanaMolinaRotationRow("M"), rotation_id: JUANA_MOLINA_SECOND_ROTATION_ID },
        ],
        { buildRow: buildJuanaMolinaRow },
      );
      renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      expect(await screen.findByRole("button", { name: "Kill H" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Kill M" })).toBeInTheDocument();
      expect(screen.getByText("In Rotation (H)")).toBeInTheDocument();
      expect(screen.getByText("In Rotation (M)")).toBeInTheDocument();
    });

    it("retires only the targeted bin, leaving the album's other active entry visible and killable", async () => {
      const backend = fakeRotationEndpoints(
        [
          juanaMolinaRotationRow("H"),
          { ...juanaMolinaRotationRow("M"), rotation_id: JUANA_MOLINA_SECOND_ROTATION_ID },
        ],
        { buildRow: buildJuanaMolinaRow },
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await user.click(await screen.findByRole("button", { name: "Kill H" }));

      await waitFor(() =>
        expect(backend.killBodies()).toEqual([{ rotation_id: JUANA_MOLINA_ROTATION_ID }]),
      );
      expect(await screen.findByRole("button", { name: "Kill M" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Kill H" })).not.toBeInTheDocument();
    });

    it("shows the busy state only on the row whose kill is in flight, not every active bin", async () => {
      const { releaseKill } = fakeRotationEndpointsWithGatedKill(
        [
          juanaMolinaRotationRow("H"),
          { ...juanaMolinaRotationRow("M"), rotation_id: JUANA_MOLINA_SECOND_ROTATION_ID },
        ],
        { buildRow: buildJuanaMolinaRow },
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      const killH = await screen.findByRole("button", { name: "Kill H" });
      const killM = screen.getByRole("button", { name: "Kill M" });
      await user.click(killH);

      await waitFor(() => expect(killH).toBeDisabled());
      expect(killM).not.toBeDisabled();

      releaseKill();
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Kill H" })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: "Kill M" })).not.toBeDisabled();
    });

    it("keeps a row busy while its own kill is in flight even after a second row's kill is issued", async () => {
      const { releaseKill } = fakeRotationEndpointsWithGatedKill(
        [
          juanaMolinaRotationRow("H"),
          { ...juanaMolinaRotationRow("M"), rotation_id: JUANA_MOLINA_SECOND_ROTATION_ID },
        ],
        { buildRow: buildJuanaMolinaRow },
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      const killH = await screen.findByRole("button", { name: "Kill H" });
      const killM = screen.getByRole("button", { name: "Kill M" });

      await user.click(killH);
      await waitFor(() => expect(killH).toBeDisabled());

      await user.click(killM);
      await waitFor(() => expect(killM).toBeDisabled());
      // H's kill is still open — issuing M's kill must not un-spin it.
      expect(killH).toBeDisabled();

      releaseKill();
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Kill H" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Kill M" })).not.toBeInTheDocument();
      });
    });
  });

  describe("rotation state that isn't known yet", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("does not fail open to the Add picker when the first rotation-list fetch errors", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({ error: "unreachable" }, { status: 500 }),
        ),
      );
      renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      expect(await screen.findByText("Rotation status unavailable")).toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: "Rotation bin" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Kill/ })).not.toBeInTheDocument();
    });

    it("recovers once the MD clicks Retry after the endpoint comes back, with no remount", async () => {
      let endpointRecovered = false;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
          if (endpointRecovered) {
            return HttpResponse.json([juanaMolinaRotationRow()]);
          }
          return HttpResponse.json({ error: "unreachable" }, { status: 500 });
        }),
      );
      const { user } = renderWithProviders(
        inModernTheme(<RotationClassifyControl album={juanaMolinaAlbum()} />),
      );

      await screen.findByText("Rotation status unavailable");
      endpointRecovered = true;
      await user.click(screen.getByRole("button", { name: "Retry" }));

      expect(await screen.findByRole("button", { name: "Kill H" })).toBeInTheDocument();
    });
  });

  describe("an album not linked to the library catalog", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("explains why instead of offering a bin picker that can never submit", async () => {
      fakeRotationEndpoints([], { buildRow: buildJuanaMolinaRow });
      renderWithProviders(
        inModernTheme(
          <RotationClassifyControl album={{ ...juanaMolinaAlbum(), id: -1 }} />,
        ),
      );

      expect(
        await screen.findByText("Not linked to a library album — can't be classified"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: "Rotation bin" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Set Rotation" }),
      ).not.toBeInTheDocument();
    });
  });
});
