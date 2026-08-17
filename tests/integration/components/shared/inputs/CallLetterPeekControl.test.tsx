import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/tests/helpers";
import CallLetterPeekControl from "@/src/components/shared/inputs/CallLetterPeekControl";

const GENRE_ID = TEST_ENTITY_IDS.GENRE.ROCK;
const { MOLINA, STEREOLAB } = TEST_SEARCH_STRINGS.CODE_LETTERS;

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

// Awaits the org-role fetch actually settling (not just having been called)
// so callers can assert a negative afterward without racing the pending
// promise — asserting immediately after render would pass vacuously while
// RequireMD is still resolving authority.
async function awaitRoleResolution() {
  await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
  await mockFetchOrgRole.mock.results[0].value;
}

function mockPeekCode() {
  let requestCount = 0;
  let receivedParams: URLSearchParams | undefined;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, ({ request }) => {
      requestCount += 1;
      receivedParams = new URL(request.url).searchParams;
      return HttpResponse.json({ next_code_number: 7 });
    }),
  );
  return { getReceivedParams: () => receivedParams, getRequestCount: () => requestCount };
}

describe("CallLetterPeekControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission gating", () => {
    it("renders nothing and never queries peek-code for a DJ", async () => {
      const { getRequestCount } = mockPeekCode();
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );

      await awaitRoleResolution();
      await waitFor(() =>
        expect(screen.queryByTestId("next-code-number")).not.toBeInTheDocument(),
      );
      expect(getRequestCount()).toBe(0);
    });

    it("renders for a Music Director", async () => {
      mockPeekCode();
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );

      expect(await screen.findByTestId("next-code-number")).toBeInTheDocument();
    });
  });

  describe("as an MD", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    it("queries peek-code with the code_letters and genre_id props and previews the response", async () => {
      const { getReceivedParams } = mockPeekCode();
      renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );

      await waitFor(() => {
        const params = getReceivedParams();
        expect(params?.get("code_letters")).toBe(MOLINA);
        expect(params?.get("genre_id")).toBe(String(GENRE_ID));
      });

      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");
    });

    it("resolves the org role exactly once across a clear-and-retype cycle", async () => {
      mockPeekCode();
      const { rerender } = renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );
      await awaitRoleResolution();

      // Clearing code_letters must not unmount RequireMD: if the validity
      // guard ever moves above it, this cycle re-triggers org-role
      // resolution on every keystroke that empties and refills the input.
      rerender(<CallLetterPeekControl code_letters="" genre_id={GENRE_ID} />);
      rerender(<CallLetterPeekControl code_letters={STEREOLAB} genre_id={GENRE_ID} />);

      expect(await screen.findByTestId("next-code-number")).toBeInTheDocument();
      expect(mockFetchOrgRole).toHaveBeenCalledTimes(1);
    });

    it("re-queries reactively when code_letters changes", async () => {
      const { getReceivedParams } = mockPeekCode();
      const { rerender } = renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );

      await waitFor(() => expect(getReceivedParams()?.get("code_letters")).toBe(MOLINA));

      rerender(<CallLetterPeekControl code_letters={STEREOLAB} genre_id={GENRE_ID} />);

      await waitFor(() => expect(getReceivedParams()?.get("code_letters")).toBe(STEREOLAB));
    });

    it("shows a loading state instead of the previous letters' code number during the debounce window", async () => {
      mockPeekCode();
      const { rerender } = renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );

      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");

      rerender(<CallLetterPeekControl code_letters={STEREOLAB} genre_id={GENRE_ID} />);

      expect(screen.queryByTestId("next-code-number")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Loading next code number")).toBeInTheDocument();
    });

    it("coalesces rapid code_letters changes into a single debounced request", async () => {
      const { getRequestCount } = mockPeekCode();
      const { rerender } = renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );

      // Let the control mount and settle before exercising rapid changes, so
      // the debounce hook is already live rather than seeding fresh off a
      // cold mount (which would trivially coalesce even without debouncing).
      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");
      expect(getRequestCount()).toBe(1);

      rerender(<CallLetterPeekControl code_letters="MOX" genre_id={GENRE_ID} />);
      rerender(<CallLetterPeekControl code_letters="MOXY" genre_id={GENRE_ID} />);
      rerender(<CallLetterPeekControl code_letters="MOXYZ" genre_id={GENRE_ID} />);
      rerender(<CallLetterPeekControl code_letters={STEREOLAB} genre_id={GENRE_ID} />);

      await waitFor(() => expect(getRequestCount()).toBe(2));
      expect(screen.getByTestId("next-code-number")).toHaveTextContent("7");
    });

    it("renders nothing and never queries peek-code when code_letters is blank", async () => {
      const { getRequestCount } = mockPeekCode();
      renderWithProviders(<CallLetterPeekControl code_letters="" genre_id={GENRE_ID} />);

      await awaitRoleResolution();
      expect(screen.queryByText("Next code:")).not.toBeInTheDocument();
      expect(getRequestCount()).toBe(0);
    });

    it("renders nothing and never queries peek-code when code_letters is whitespace-only", async () => {
      const { getRequestCount } = mockPeekCode();
      renderWithProviders(<CallLetterPeekControl code_letters="   " genre_id={GENRE_ID} />);

      await awaitRoleResolution();
      expect(screen.queryByText("Next code:")).not.toBeInTheDocument();
      expect(getRequestCount()).toBe(0);
    });

    it("renders nothing and never queries peek-code when genre_id is not selected", async () => {
      const { getRequestCount } = mockPeekCode();
      renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={null} />,
      );

      await awaitRoleResolution();
      expect(screen.queryByText("Next code:")).not.toBeInTheDocument();
      expect(getRequestCount()).toBe(0);
    });

    it("shows an error message when the peek query fails", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      renderWithProviders(<CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />);

      expect(await screen.findByText("Unable to preview code")).toBeInTheDocument();
    });

    it("does not let a slow response for a superseded input overwrite the current one", async () => {
      let molinaRequestStarted = false;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, async ({ request }) => {
          const codeLetters = new URL(request.url).searchParams.get("code_letters");
          if (codeLetters === MOLINA) {
            molinaRequestStarted = true;
            await delay(600);
            return HttpResponse.json({ next_code_number: 1 });
          }
          return HttpResponse.json({ next_code_number: 2 });
        }),
      );

      const { rerender } = renderWithProviders(
        <CallLetterPeekControl code_letters={MOLINA} genre_id={GENRE_ID} />,
      );

      // Let the slow MOLINA request actually go in flight before switching.
      await waitFor(() => expect(molinaRequestStarted).toBe(true));

      rerender(<CallLetterPeekControl code_letters={STEREOLAB} genre_id={GENRE_ID} />);

      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("2");

      // Let the superseded MOLINA response land; it must never overwrite the
      // now-current STEREOLAB value.
      await delay(700);
      expect(screen.getByTestId("next-code-number")).toHaveTextContent("2");
    });
  });
});
