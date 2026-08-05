import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import type { ArtistInGenreOption } from "@/lib/features/catalog/types";

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
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

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

const ARTIST_SEARCH_URL = `${TEST_BACKEND_URL}/library/artists/search`;

const juanaMolina: ArtistInGenreOption = {
  id: 12,
  artist_name: "Juana Molina",
  code_letters: "MO",
  code_number: 3,
};

function mockArtistSearch(artists: ArtistInGenreOption[]) {
  let capturedUrl: URL | undefined;
  server.use(
    http.get(ARTIST_SEARCH_URL, ({ request }) => {
      capturedUrl = new URL(request.url);
      return HttpResponse.json({ artists });
    }),
  );
  return () => capturedUrl;
}

describe("ArtistSearchTypeahead", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(
        <ArtistSearchTypeahead
          genreId={1}
          onSelect={vi.fn()}
          onCreateNew={vi.fn()}
        />,
      );

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(
          screen.queryByPlaceholderText("Search artists..."),
        ).not.toBeInTheDocument(),
      );
    });

    it("renders the search input for a Music Director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(
        <ArtistSearchTypeahead
          genreId={1}
          onSelect={vi.fn()}
          onCreateNew={vi.fn()}
        />,
      );

      expect(
        await screen.findByPlaceholderText("Search artists..."),
      ).toBeInTheDocument();
    });
  });

  describe("querying", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("debounces the query and scopes it to the given genre", async () => {
      const getUrl = mockArtistSearch([juanaMolina]);
      const { user } = renderWithProviders(
        <ArtistSearchTypeahead
          genreId={7}
          onSelect={vi.fn()}
          onCreateNew={vi.fn()}
        />,
      );

      const input = await screen.findByPlaceholderText("Search artists...");
      await user.type(input, "Juana");

      expect(getUrl()).toBeUndefined();

      await vi.advanceTimersByTimeAsync(400);
      await waitFor(() => expect(getUrl()).toBeDefined());

      expect(getUrl()!.searchParams.get("q")).toBe("Juana");
      expect(getUrl()!.searchParams.get("genre_id")).toBe("7");
    });

    it("does not query below the minimum query length", async () => {
      const getUrl = mockArtistSearch([juanaMolina]);
      const { user } = renderWithProviders(
        <ArtistSearchTypeahead
          genreId={7}
          onSelect={vi.fn()}
          onCreateNew={vi.fn()}
        />,
      );

      const input = await screen.findByPlaceholderText("Search artists...");
      await user.type(input, "J");
      await vi.advanceTimersByTimeAsync(400);

      expect(getUrl()).toBeUndefined();
    });

    it("renders matching results", async () => {
      mockArtistSearch([juanaMolina]);
      const { user } = renderWithProviders(
        <ArtistSearchTypeahead
          genreId={7}
          onSelect={vi.fn()}
          onCreateNew={vi.fn()}
        />,
      );

      const input = await screen.findByPlaceholderText("Search artists...");
      await user.type(input, "Juana");
      await vi.advanceTimersByTimeAsync(400);

      expect(await screen.findByText("Juana Molina")).toBeInTheDocument();
    });
  });

  describe("selection", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("calls onSelect with the full artist object on click", async () => {
      mockArtistSearch([juanaMolina]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ArtistSearchTypeahead
          genreId={7}
          onSelect={onSelect}
          onCreateNew={vi.fn()}
        />,
      );

      const input = await screen.findByPlaceholderText("Search artists...");
      await user.type(input, "Juana");
      await vi.advanceTimersByTimeAsync(400);

      await user.click(await screen.findByText("Juana Molina"));

      expect(onSelect).toHaveBeenCalledWith(juanaMolina);
    });

    it("navigates results with the keyboard and selects with Enter", async () => {
      mockArtistSearch([
        juanaMolina,
        { id: 20, artist_name: "Chuquimamani-Condori", code_letters: "CH", code_number: 1 },
      ]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ArtistSearchTypeahead
          genreId={7}
          onSelect={onSelect}
          onCreateNew={vi.fn()}
        />,
      );

      const input = await screen.findByPlaceholderText("Search artists...");
      await user.type(input, "Juana");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText("Juana Molina");

      await user.keyboard("{ArrowDown}{Enter}");

      expect(onSelect).toHaveBeenCalledWith({
        id: 20,
        artist_name: "Chuquimamani-Condori",
        code_letters: "CH",
        code_number: 1,
      });
    });
  });

  describe("no matches", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("offers to create a new artist with the current search term", async () => {
      mockArtistSearch([]);
      const onCreateNew = vi.fn();
      const { user } = renderWithProviders(
        <ArtistSearchTypeahead
          genreId={7}
          onSelect={vi.fn()}
          onCreateNew={onCreateNew}
        />,
      );

      const input = await screen.findByPlaceholderText("Search artists...");
      await user.type(input, "Nonexistent Band");
      await vi.advanceTimersByTimeAsync(400);

      const createOption = await screen.findByText(
        'Create new artist "Nonexistent Band"',
      );
      await user.click(createOption);

      expect(onCreateNew).toHaveBeenCalledWith("Nonexistent Band");
    });
  });
});
