import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

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

const mockAddToBin = vi.fn();
const mockDeleteFromBin = vi.fn();
let mockBinContents: { id: number }[] = [];
vi.mock("@/src/hooks/binHooks", () => ({
  useBin: () => ({ bin: mockBinContents, loading: false }),
  useAddToBin: () => ({ addToBin: mockAddToBin, loading: false }),
  useDeleteFromBin: () => ({ deleteFromBin: mockDeleteFromBin, loading: false }),
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import { toast } from "sonner";
import CatalogResultContextMenu from "@/src/components/experiences/modern/catalog/Results/CatalogResultContextMenu";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

const ALBUM_ID = 4242;
const ROTATION_ID = 900;

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

const dogaAlbum = () =>
  createTestAlbum({
    id: ALBUM_ID,
    title: "DOGA",
    artist: createTestArtist({
      name: "Juana Molina",
      lettercode: "MO",
      numbercode: 12,
      genre: "Rock",
    }),
    label: "Sonamos",
  });

const rotationRow = (rotationBin = "H") => ({
  id: ALBUM_ID,
  code_letters: "MO",
  code_artist_number: 12,
  code_number: 3,
  artist_name: "Juana Molina",
  alphabetical_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  genre_name: "Rock",
  format_name: "CD",
  rotation_id: ROTATION_ID,
  add_date: "2026-07-01",
  rotation_add_date: "2026-08-01",
  rotation_bin: rotationBin,
  rotation_kill_date: null,
  plays: 4,
});

function fakeRotationEndpoints(initial: ReturnType<typeof rotationRow>[] = []) {
  let rows = [...initial];
  const received: { add?: unknown; kills: unknown[] } = { kills: [] };
  const counters = { listRequests: 0 };

  server.use(
    http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
      counters.listRequests += 1;
      return HttpResponse.json(rows);
    }),
    http.post(`${TEST_BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as {
        album_id: number;
        rotation_bin: string;
      };
      received.add = body;
      rows = [...rows, rotationRow(body.rotation_bin)];
      return HttpResponse.json(
        {
          id: ROTATION_ID,
          album_id: body.album_id,
          rotation_bin: body.rotation_bin,
          add_date: "2026-08-18",
          kill_date: null,
        },
        { status: 201 },
      );
    }),
    http.patch(`${TEST_BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as { rotation_id: number };
      received.kills.push(body);
      rows = rows.filter((r) => r.rotation_id !== body.rotation_id);
      return HttpResponse.json({ id: body.rotation_id, kill_date: "2026-08-18" });
    }),
  );

  return { received, counters };
}

const menuAt = (album = dogaAlbum()) => ({ album, top: 100, left: 100 });

describe("CatalogResultContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBinContents = [];
    mockUseSession.mockReturnValue(sessionWithRole());
    mockFetchOrgRole.mockResolvedValue("dj");
  });

  it("navigates to the album detail route from More information and closes", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={onClose} />,
    );

    await userEvent.click(
      screen.getByRole("menuitem", { name: "More information" }),
    );
    expect(mockPush).toHaveBeenCalledWith(`/dashboard/album/${ALBUM_ID}`);
    expect(onClose).toHaveBeenCalled();
  });

  it("adds to the mail bin when absent and removes when present", async () => {
    const onClose = vi.fn();
    const { unmount } = renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={onClose} />,
    );

    await userEvent.click(
      screen.getByRole("menuitem", { name: "Add to mail bin" }),
    );
    expect(mockAddToBin).toHaveBeenCalledWith(ALBUM_ID);
    unmount();

    mockBinContents = [{ id: ALBUM_ID }];
    renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={vi.fn()} />,
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Remove from mail bin" }),
    );
    expect(mockDeleteFromBin).toHaveBeenCalledWith(ALBUM_ID);
  });

  it("shows no MD items for a DJ", async () => {
    fakeRotationEndpoints();
    renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={vi.fn()} />,
    );

    // The role resolution is async; give the authorized branch time to appear
    // if it (incorrectly) would.
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "More information" })).toBeInTheDocument(),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole("menuitem", { name: "Edit catalog entry" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Rotation")).not.toBeInTheDocument();
  });

  it("shows Edit and the rotation section with the active bin checked for an MD", async () => {
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    fakeRotationEndpoints([rotationRow("H")]);

    renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={vi.fn()} />,
    );

    expect(
      await screen.findByRole("menuitem", { name: "Edit catalog entry" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Rotation")).toBeInTheDocument();
    expect(
      await screen.findByRole("menuitem", { name: "Remove from rotation" }),
    ).toBeInTheDocument();

    // The active bin row carries the check icon.
    const heavyItem = await screen.findByRole("menuitem", {
      name: /Heavy \(H\)/,
    });
    expect(heavyItem.querySelector("svg")).not.toBeNull();
  });

  it("POSTs the picked bin, toasts, and closes", async () => {
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    const { received } = fakeRotationEndpoints();
    const onClose = vi.fn();

    renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={onClose} />,
    );

    const mediumItem = await screen.findByRole("menuitem", {
      name: /Medium \(M\)/,
    });
    await waitFor(() =>
      expect(mediumItem).not.toHaveAttribute("aria-disabled", "true"),
    );
    await userEvent.click(mediumItem);

    await waitFor(() =>
      expect(received.add).toEqual({ album_id: ALBUM_ID, rotation_bin: "M" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Marked for M rotation.");
    expect(onClose).toHaveBeenCalled();
  });

  it("re-binning kills the active entry before adding the new bin", async () => {
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    const { received } = fakeRotationEndpoints([rotationRow("H")]);
    const onClose = vi.fn();

    renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={onClose} />,
    );

    const lightItem = await screen.findByRole("menuitem", {
      name: /Light \(L\)/,
    });
    await waitFor(() =>
      expect(lightItem).not.toHaveAttribute("aria-disabled", "true"),
    );
    await userEvent.click(lightItem);

    await waitFor(() =>
      expect(received.add).toEqual({ album_id: ALBUM_ID, rotation_bin: "L" }),
    );
    expect(received.kills).toEqual([{ rotation_id: ROTATION_ID }]);
  });

  it("fails closed while rotation membership is unknown", async () => {
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    // A list that never resolves within the test: membership stays unknown.
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, async () => {
        await new Promise((r) => setTimeout(r, 60_000));
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={vi.fn()} />,
    );

    expect(
      await screen.findByText("Rotation — checking status…"),
    ).toBeInTheDocument();
    const heavyItem = screen.getByRole("menuitem", {
      name: /Heavy \(H\)/,
    });
    expect(heavyItem).toHaveAttribute("aria-disabled", "true");
  });

  it("does not refetch the shared rotation list across menu open/close cycles", async () => {
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    const { counters } = fakeRotationEndpoints([rotationRow("H")]);

    const first = renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={vi.fn()} />,
    );
    await first.findByText("Rotation");
    const requestsAfterFirstOpen = counters.listRequests;
    first.unmount();

    const second = renderWithProviders(
      <CatalogResultContextMenu menu={menuAt()} onClose={vi.fn()} />,
      { store: first.store },
    );
    await second.findByText("Rotation");
    expect(counters.listRequests).toBe(requestsAfterFirstOpen);
    expect(requestsAfterFirstOpen).toBe(1);
  });
});
