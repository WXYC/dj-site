import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
  fakeRotationEndpoints,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import AlbumArtworkWithRotationBadge from "@/src/components/experiences/modern/catalog/album/AlbumArtworkWithRotationBadge";

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

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

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

const codePreview = {
  genreName: "Rock",
  codeLetters: "MO",
  artistNumber: 12,
  albumEntry: "3",
  formatLabel: "CD",
};

describe("AlbumArtworkWithRotationBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the badge-less artwork and issues no rotation request for a DJ", async () => {
    const backend = fakeRotationEndpoints([rotationRow("H")], {
      buildRow: (bin) => rotationRow(bin),
    });
    mockFetchOrgRole.mockResolvedValue("dj");
    mockUseSession.mockReturnValue(sessionWithRole());

    renderWithProviders(
      <AlbumArtworkWithRotationBadge
        album={dogaAlbum()}
        artworkUrl="https://example.com/cover.jpg"
        alt="DOGA cover"
        codePreview={codePreview}
      />,
    );

    expect(await screen.findByAltText("DOGA cover")).toBeInTheDocument();
    await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
    await mockFetchOrgRole.mock.results[0].value;
    expect(screen.queryByText("H")).not.toBeInTheDocument();
    // No badge ever appears on a DJ's artwork, so its absence claims nothing
    // and the unknown marker must not leak into the unauthorized fallback.
    expect(screen.queryByTitle("Rotation status unknown")).not.toBeInTheDocument();
    expect(backend.listRequests()).toBe(0);
  });

  it("shows the rotation badge for a Music Director with an active entry", async () => {
    fakeRotationEndpoints([rotationRow("H")], { buildRow: (bin) => rotationRow(bin) });
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());

    renderWithProviders(
      <AlbumArtworkWithRotationBadge
        album={dogaAlbum()}
        artworkUrl="https://example.com/cover.jpg"
        alt="DOGA cover"
        codePreview={codePreview}
      />,
    );

    expect(await screen.findByText("H")).toBeInTheDocument();
  });

  it("shows no badge for a Music Director when the album has no active entry", async () => {
    const backend = fakeRotationEndpoints([], { buildRow: (bin) => rotationRow(bin) });
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());

    renderWithProviders(
      <AlbumArtworkWithRotationBadge
        album={dogaAlbum()}
        artworkUrl="https://example.com/cover.jpg"
        alt="DOGA cover"
        codePreview={codePreview}
      />,
    );

    await waitFor(() => expect(backend.listRequests()).toBeGreaterThan(0));
    expect(screen.queryByText("H")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Rotation status unknown")).not.toBeInTheDocument();
  });

  // An MD sees badges, so for them a badge-less card is a positive claim that
  // the album is in no bin. Making that claim from a read that has not landed
  // also contradicts the "Rotation status unavailable" the classify control
  // renders on the same card.
  it("marks the rotation status unknown for a Music Director while the read is in flight", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return HttpResponse.json([]);
      }),
    );
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());

    renderWithProviders(
      <AlbumArtworkWithRotationBadge
        album={dogaAlbum()}
        artworkUrl="https://example.com/cover.jpg"
        alt="DOGA cover"
        codePreview={codePreview}
      />,
    );

    expect(await screen.findByTitle("Rotation status unknown")).toHaveTextContent("?");
  });

  it("marks the rotation status unknown for a Music Director when the read errors", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
        HttpResponse.json({ error: "unreachable" }, { status: 500 }),
      ),
    );
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());

    renderWithProviders(
      <AlbumArtworkWithRotationBadge
        album={dogaAlbum()}
        artworkUrl="https://example.com/cover.jpg"
        alt="DOGA cover"
        codePreview={codePreview}
      />,
    );

    expect(await screen.findByTitle("Rotation status unknown")).toBeInTheDocument();
  });
});
