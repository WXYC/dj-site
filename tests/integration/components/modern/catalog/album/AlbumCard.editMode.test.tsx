import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import AlbumCard from "@/src/components/experiences/modern/catalog/album/AlbumCard";

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

vi.mock("@/src/components/experiences/modern/catalog/album/DiscogsMarkupRenderer", () => ({
  default: () => <span>mocked bio</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/LibraryStatus", () => ({
  default: () => <span>mocked status</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/StreamingLinks", () => ({
  default: () => <span>mocked streaming links</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/Tracklist", () => ({
  default: () => <span>mocked tracklist</span>,
}));
vi.mock("@/src/components/experiences/modern/reviews/ReviewsPanel", () => ({
  default: () => <span>mocked reviews</span>,
}));

// The four edit controls are stubbed with markers so the assertions read the
// card's own view/edit gate rather than each control's internal role gate.
vi.mock("@/src/components/experiences/modern/catalog/album/DiscogsUnavailableControl", () => ({
  default: () => <span>mocked discogs-unavailable control</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/AlbumEditForm", () => ({
  default: () => <span>mocked album edit form</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/RotationClassifyControl", () => ({
  default: () => <span>mocked rotation classify control</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/CompilationCreditsControl", () => ({
  default: () => <span>mocked compilation credits control</span>,
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

const EDIT_CONTROLS = [
  "mocked discogs-unavailable control",
  "mocked album edit form",
  "mocked rotation classify control",
  "mocked compilation credits control",
];

const defaultProps = {
  artworkUrl: "https://example.com/cover.jpg",
  metadata: null,
  metadataLoading: false,
  artistBio: null,
  bioTokens: null,
  artistWikipediaUrl: null,
};

const doga = createTestAlbum({
  id: 4242,
  title: "DOGA",
  artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 12 }),
  label: "Sonamos",
});

const onYourOwnLoveAgain = createTestAlbum({
  id: 4343,
  title: "On Your Own Love Again",
  artist: createTestArtist({ name: "Jessica Pratt", lettercode: "PR", numbercode: 7 }),
  label: "Drag City",
});

function signInAs(role: string) {
  mockFetchOrgRole.mockResolvedValue(role);
  mockUseSession.mockReturnValue({
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
  });
}

async function settleRole() {
  await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
  await mockFetchOrgRole.mock.results[0].value;
}

function expectNoEditControls() {
  for (const control of EDIT_CONTROLS) {
    expect(screen.queryByText(control)).not.toBeInTheDocument();
  }
}

describe("AlbumCard view/edit mode", () => {
  beforeEach(() => {
    mockFetchOrgRole.mockReset();
    mockUseSession.mockReset();
  });

  it.each([
    { role: "dj", canEdit: false },
    { role: "musicDirector", canEdit: true },
    { role: "stationManager", canEdit: true },
  ])("opens read-only for $role (Edit button shown: $canEdit)", async ({ role, canEdit }) => {
    signInAs(role);
    renderWithProviders(<AlbumCard album={doga} {...defaultProps} />);
    await settleRole();

    if (canEdit) {
      expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    } else {
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument(),
      );
    }
    expectNoEditControls();
    expect(screen.getByText("mocked tracklist")).toBeInTheDocument();
    expect(screen.getByText("mocked reviews")).toBeInTheDocument();
  });

  it("shows all four controls on Edit and hides them on Done", async () => {
    const user = userEvent.setup();
    signInAs("musicDirector");
    renderWithProviders(<AlbumCard album={doga} {...defaultProps} />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));

    for (const control of EDIT_CONTROLS) {
      expect(screen.getByText(control)).toBeInTheDocument();
    }
    expect(screen.getByText("mocked tracklist")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));

    expectNoEditControls();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("returns to view mode when a different release is shown", async () => {
    const user = userEvent.setup();
    signInAs("musicDirector");
    const { rerender } = renderWithProviders(<AlbumCard album={doga} {...defaultProps} />);

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByText("mocked album edit form")).toBeInTheDocument();

    rerender(<AlbumCard album={onYourOwnLoveAgain} {...defaultProps} />);

    expectNoEditControls();
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});
