import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import GenreAdmin from "@/src/components/experiences/modern/admin/catalog/GenreAdmin";

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

function mockGenres(initial: { id: number; genre_name: string }[]) {
  let genres = [...initial];
  let receivedBody: unknown;

  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () => HttpResponse.json(genres)),
    http.post(`${TEST_BACKEND_URL}/library/genres`, async ({ request }) => {
      receivedBody = await request.json();
      const { name, description } = receivedBody as { name: string; description: string };
      const created = { id: genres.length + 1, genre_name: name, description };
      genres = [...genres, created];
      return HttpResponse.json(created);
    }),
  );

  return { getReceivedBody: () => receivedBody };
}

describe("GenreAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockGenres([]);
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<GenreAdmin />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /Add Genre/i })).not.toBeInTheDocument(),
      );
    });

    it("renders the form for a Music Director", async () => {
      mockGenres([]);
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<GenreAdmin />);

      expect(await screen.findByRole("button", { name: /Add Genre/i })).toBeInTheDocument();
    });
  });

  describe("as a Music Director", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("lists existing genres", async () => {
      mockGenres([{ id: 1, genre_name: "Rock" }, { id: 2, genre_name: "Jazz" }]);
      renderWithProviders(<GenreAdmin />);

      expect(await screen.findByText("Rock")).toBeInTheDocument();
      expect(screen.getByText("Jazz")).toBeInTheDocument();
    });

    it("POSTs the new genre name and description, and shows it in the list on success", async () => {
      const { getReceivedBody } = mockGenres([{ id: 1, genre_name: "Rock" }]);
      const { user } = renderWithProviders(<GenreAdmin />);

      await screen.findByText("Rock");

      await user.type(screen.getByLabelText(/genre name/i), "Electronic");
      await user.type(screen.getByLabelText(/description/i), "Synth-driven music");
      await user.click(screen.getByRole("button", { name: /Add Genre/i }));

      await waitFor(() =>
        expect(getReceivedBody()).toEqual({
          name: "Electronic",
          description: "Synth-driven music",
        }),
      );
      expect(await screen.findByText("Electronic")).toBeInTheDocument();
    });

    it("clears the inputs after a successful add", async () => {
      mockGenres([]);
      const { user } = renderWithProviders(<GenreAdmin />);

      const nameInput = await screen.findByLabelText(/genre name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(nameInput, "Electronic");
      await user.type(descriptionInput, "Synth-driven music");
      await user.click(screen.getByRole("button", { name: /Add Genre/i }));

      await waitFor(() => expect(nameInput).toHaveValue(""));
      expect(descriptionInput).toHaveValue("");
    });

    it("shows an error toast when the add fails", async () => {
      mockGenres([]);
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/genres`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(<GenreAdmin />);

      const nameInput = await screen.findByLabelText(/genre name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(nameInput, "Electronic");
      await user.type(descriptionInput, "Synth-driven music");
      await user.click(screen.getByRole("button", { name: /Add Genre/i }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to add genre"));
    });

    it("surfaces the server's error message instead of a generic one", async () => {
      mockGenres([]);
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/genres`, () =>
          HttpResponse.json({ message: "A genre named Electronic already exists" }, { status: 409 }),
        ),
      );
      const { user } = renderWithProviders(<GenreAdmin />);

      const nameInput = await screen.findByLabelText(/genre name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(nameInput, "Electronic");
      await user.type(descriptionInput, "Synth-driven music");
      await user.click(screen.getByRole("button", { name: /Add Genre/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("A genre named Electronic already exists"),
      );
    });

    it("shows an error toast and does not submit when the name is whitespace-only", async () => {
      const { getReceivedBody } = mockGenres([]);
      const { user } = renderWithProviders(<GenreAdmin />);

      const nameInput = await screen.findByLabelText(/genre name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(nameInput, "   ");
      await user.type(descriptionInput, "Synth-driven music");
      await user.click(screen.getByRole("button", { name: /Add Genre/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Genre name can't be blank"),
      );
      expect(getReceivedBody()).toBeUndefined();
    });

    it("shows an error toast and does not submit when the description is whitespace-only", async () => {
      const { getReceivedBody } = mockGenres([]);
      const { user } = renderWithProviders(<GenreAdmin />);

      const nameInput = await screen.findByLabelText(/genre name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(nameInput, "Electronic");
      await user.type(descriptionInput, "   ");
      await user.click(screen.getByRole("button", { name: /Add Genre/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Genre description can't be blank"),
      );
      expect(getReceivedBody()).toBeUndefined();
    });
  });
});
