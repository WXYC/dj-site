import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import CallLetterPeekControl from "@/src/components/experiences/modern/catalog/ArtistAdd/CallLetterPeekControl";

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

function mockPeekCode() {
  let receivedParams: URLSearchParams | undefined;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, ({ request }) => {
      receivedParams = new URL(request.url).searchParams;
      return HttpResponse.json({ next_code_number: 7 });
    }),
  );
  return () => receivedParams;
}

describe("CallLetterPeekControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockPeekCode();
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(
        <CallLetterPeekControl code_letters="MO" genre_id={3} />,
      );

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(screen.queryByLabelText("Next code number")).not.toBeInTheDocument(),
      );
    });

    it("renders for a Music Director", async () => {
      mockPeekCode();
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(
        <CallLetterPeekControl code_letters="MO" genre_id={3} />,
      );

      expect(await screen.findByLabelText("Next code number")).toBeInTheDocument();
    });
  });

  describe("as an MD", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("queries peek-code with the code_letters and genre_id props and previews the response", async () => {
      const getReceivedParams = mockPeekCode();
      renderWithProviders(
        <CallLetterPeekControl code_letters="MO" genre_id={3} />,
      );

      await waitFor(() => {
        const params = getReceivedParams();
        expect(params?.get("code_letters")).toBe("MO");
        expect(params?.get("genre_id")).toBe("3");
      });

      expect(await screen.findByLabelText("Next code number")).toHaveTextContent("7");
    });

    it("re-queries reactively when code_letters changes", async () => {
      const getReceivedParams = mockPeekCode();
      const { rerender } = renderWithProviders(
        <CallLetterPeekControl code_letters="MO" genre_id={3} />,
      );

      await waitFor(() => expect(getReceivedParams()?.get("code_letters")).toBe("MO"));

      rerender(<CallLetterPeekControl code_letters="ST" genre_id={3} />);

      await waitFor(() => expect(getReceivedParams()?.get("code_letters")).toBe("ST"));
    });

    it("renders nothing when code_letters is blank", () => {
      mockPeekCode();
      renderWithProviders(<CallLetterPeekControl code_letters="" genre_id={3} />);

      expect(screen.queryByLabelText("Next code number")).not.toBeInTheDocument();
    });

    it("renders nothing when genre_id is not selected", () => {
      mockPeekCode();
      renderWithProviders(
        <CallLetterPeekControl code_letters="MO" genre_id={null} />,
      );

      expect(screen.queryByLabelText("Next code number")).not.toBeInTheDocument();
    });

    it("shows an error message when the peek query fails", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      renderWithProviders(<CallLetterPeekControl code_letters="MO" genre_id={3} />);

      expect(await screen.findByText("Unable to preview code")).toBeInTheDocument();
    });
  });
});
