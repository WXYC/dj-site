import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import FormatAdmin from "@/src/components/experiences/modern/admin/catalog/FormatAdmin";

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

function mockFormats(initial: { id: number; format_name: string }[]) {
  let formats = [...initial];
  let receivedBody: unknown;

  server.use(
    http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json(formats)),
    http.post(`${TEST_BACKEND_URL}/library/formats`, async ({ request }) => {
      receivedBody = await request.json();
      const { name } = receivedBody as { name: string };
      const created = { id: formats.length + 1, format_name: name };
      formats = [...formats, created];
      return HttpResponse.json(created);
    }),
  );

  return { getReceivedBody: () => receivedBody };
}

describe("FormatAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFormats([]);
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<FormatAdmin />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /Add Format/i })).not.toBeInTheDocument(),
      );
    });

    it("renders the form for a Music Director", async () => {
      mockFormats([]);
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<FormatAdmin />);

      expect(await screen.findByRole("button", { name: /Add Format/i })).toBeInTheDocument();
    });
  });

  describe("as a Music Director", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("lists existing formats", async () => {
      mockFormats([{ id: 1, format_name: "Vinyl" }, { id: 2, format_name: "CD" }]);
      renderWithProviders(<FormatAdmin />);

      expect(await screen.findByText("Vinyl")).toBeInTheDocument();
      expect(screen.getByText("CD")).toBeInTheDocument();
    });

    it("POSTs the new format name and shows it in the list on success", async () => {
      const { getReceivedBody } = mockFormats([{ id: 1, format_name: "Vinyl" }]);
      const { user } = renderWithProviders(<FormatAdmin />);

      await screen.findByText("Vinyl");

      await user.type(screen.getByLabelText(/new format/i), "Cassette");
      await user.click(screen.getByRole("button", { name: /Add Format/i }));

      await waitFor(() => expect(getReceivedBody()).toEqual({ name: "Cassette" }));
      expect(await screen.findByText("Cassette")).toBeInTheDocument();
    });

    it("clears the input after a successful add", async () => {
      mockFormats([]);
      const { user } = renderWithProviders(<FormatAdmin />);

      const input = await screen.findByLabelText(/new format/i);
      await user.type(input, "Cassette");
      await user.click(screen.getByRole("button", { name: /Add Format/i }));

      await waitFor(() => expect(input).toHaveValue(""));
    });

    it("shows an error toast when the add fails", async () => {
      mockFormats([]);
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/formats`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      const { user } = renderWithProviders(<FormatAdmin />);

      const input = await screen.findByLabelText(/new format/i);
      await user.type(input, "Cassette");
      await user.click(screen.getByRole("button", { name: /Add Format/i }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to add format"));
    });

    it("surfaces the server's error message instead of a generic one", async () => {
      mockFormats([]);
      server.use(
        http.post(`${TEST_BACKEND_URL}/library/formats`, () =>
          HttpResponse.json({ message: "A format named Cassette already exists" }, { status: 409 }),
        ),
      );
      const { user } = renderWithProviders(<FormatAdmin />);

      const input = await screen.findByLabelText(/new format/i);
      await user.type(input, "Cassette");
      await user.click(screen.getByRole("button", { name: /Add Format/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("A format named Cassette already exists"),
      );
    });

    it("shows an error toast and does not submit when the name is whitespace-only", async () => {
      const { getReceivedBody } = mockFormats([]);
      const { user } = renderWithProviders(<FormatAdmin />);

      const input = await screen.findByLabelText(/new format/i);
      await user.type(input, "   ");
      await user.click(screen.getByRole("button", { name: /Add Format/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Format name can't be blank"),
      );
      expect(getReceivedBody()).toBeUndefined();
    });
  });
});
