import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect, useState } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

vi.mock("server-only", () => ({}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  // SessionUnavailable's retry button; not exercised by these tests, just
  // needed so it mounts without throwing.
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: (options: unknown) => mockGetSession(options),
  },
}));

// ThemedLayout -> createServerSideProps is a root dependency of every render
// here; stubbing it (rather than letting it run for real) is what lets the
// positive-control case reach the slots at all — see slot-defaults.test.tsx's
// mock preamble for the same shape.
const mockCreateServerSideProps = vi.fn();
vi.mock("@/lib/features/session", () => ({
  createServerSideProps: () => mockCreateServerSideProps(),
}));

import Layout from "@/app/dashboard/layout";
import { requireAuth } from "@/lib/features/authentication/server-utils";
import { createTestBetterAuthSession } from "@/tests/helpers";

/**
 * A slot double that runs the real `requireAuth()` gate once mounted. This is
 * the positive control the negative assertions below need: an element that
 * never renders never executes, so "no redirect happened" would pass just as
 * well if the layout swapped `SessionUnavailable` for `null`, or if these
 * doubles were inert. Only a marker that demonstrably ran its own gate (by
 * calling the real `requireAuth`, driven off the same mocked `getSession`)
 * makes "the slots never rendered" a falsifiable claim.
 */
function makeSlotMarker(testId: string) {
  return function SlotMarker() {
    const [ran, setRan] = useState(false);
    useEffect(() => {
      requireAuth()
        .then(() => setRan(true))
        .catch(() => {});
    }, []);
    if (!ran) return null;
    return <div data-testid={testId} />;
  };
}

const ClassicMarker = makeSlotMarker("classic-marker");
const ModernMarker = makeSlotMarker("modern-marker");
const InformationMarker = makeSlotMarker("information-marker");

describe("dashboard layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({ toString: () => "session=test-cookie" });
    mockCreateServerSideProps.mockResolvedValue({
      application: { experience: "modern", colorMode: "dark", themeId: "bluenote" },
      authentication: { message: "Not Authenticated" },
    });
  });

  it("positive control: renders the reachable slots and their own requireAuth gates demonstrably run, when the session read succeeds", async () => {
    mockGetSession.mockResolvedValue({ data: createTestBetterAuthSession(), error: null });

    const element = await Layout({
      classic: <ClassicMarker />,
      modern: <ModernMarker />,
      information: <InformationMarker />,
    });
    renderWithProviders(element);

    expect(await screen.findByTestId("modern-marker")).toBeInTheDocument();
    expect(await screen.findByTestId("information-marker")).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
    // The layout's own gate plus each mounted marker's own gate independently
    // called getSession — proof the markers' gates actually ran, not merely
    // that nothing redirected.
    expect(mockGetSession.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("renders SessionUnavailable and never mounts any slot — so no slot-level requireAuth ever runs — when the session read is unavailable (a resolved 429)", async () => {
    mockGetSession.mockResolvedValue({
      data: null,
      error: {
        message: "Too many requests. Please try again later.",
        status: 429,
        statusText: "Too Many Requests",
      },
    });

    const element = await Layout({
      classic: <ClassicMarker />,
      modern: <ModernMarker />,
      information: <InformationMarker />,
    });
    renderWithProviders(element);

    expect(screen.getByText(/we couldn.t reach the server/i)).toBeInTheDocument();
    expect(screen.queryByTestId("classic-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("modern-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("information-marker")).not.toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
    // Only the layout's own gate ever called getSession: the markers' own
    // requireAuth() never ran, because the markers never mounted.
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it("still redirects on a genuinely absent session, unchanged", async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });

    await expect(
      Layout({
        classic: <ClassicMarker />,
        modern: <ModernMarker />,
        information: <InformationMarker />,
      })
    ).rejects.toThrow("REDIRECT:/login?bounced=no-session");
    expect(mockRedirect).toHaveBeenCalledWith("/login?bounced=no-session");
  });
});
