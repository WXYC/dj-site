import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { renderWithProviders } from "@/tests/helpers";

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

let registryMock: {
  info: { id: string; real_name?: string; dj_name?: string } | null;
  loading: boolean;
} = { info: { id: "u1", real_name: "Test User", dj_name: "Anonymous" }, loading: false };

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: () => ({ handleLogout: vi.fn() }),
  useRegistry: () => registryMock,
}));

let currentPathname = "/dashboard/catalog";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import Navigation from "@/src/components/experiences/classic/Navigation";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

const FLAG = "NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED";

function session() {
  return {
    data: {
      user: {
        id: "user-1",
        email: "librarian@wxyc.org",
        name: "Test Librarian",
        username: "librarian",
        role: null,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
    },
    isPending: false,
  };
}

beforeEach(() => {
  registryMock = {
    info: { id: "u1", real_name: "Test User", dj_name: "Anonymous" },
    loading: false,
  };
  currentPathname = "/dashboard/catalog";
  mockUseSession.mockReturnValue(session());
  mockFetchOrgRole.mockResolvedValue("dj");
});

afterEach(() => {
  delete process.env[FLAG];
  vi.clearAllMocks();
});

describe("classic Navigation", () => {
  it("always renders the DJ links", async () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByText("Card Catalog")).toBeInTheDocument();
    expect(screen.getByText("Flowsheet")).toBeInTheDocument();
    expect(screen.getByText("Previous Sets")).toBeInTheDocument();
    expect(screen.getByText("Log Out")).toBeInTheDocument();
  });

  // Previous Sets was greyed out while the classic slot had no page for it.
  // It has one, so the bar must route there rather than render dead text.
  it("routes Previous Sets rather than rendering it disabled", () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByRole("link", { name: "Previous Sets" })).toHaveAttribute(
      "href",
      "/dashboard/playlists"
    );
    expect(document.querySelector(".nav-disabled")).toBeNull();
  });

  describe("signed-in identity", () => {
    it("names the signed-in DJ in the bar", () => {
      renderWithProviders(<Navigation />);

      expect(document.querySelector(".nav-identity")).toHaveTextContent(
        "Test User"
      );
    });

    it("falls back to the DJ handle when there is no real name", () => {
      registryMock = { info: { id: "u1", dj_name: "Anonymous" }, loading: false };
      renderWithProviders(<Navigation />);

      expect(document.querySelector(".nav-identity")).toHaveTextContent(
        "Anonymous"
      );
    });

    it("omits the slot entirely when no name resolves", () => {
      registryMock = { info: { id: "u1" }, loading: false };
      renderWithProviders(<Navigation />);

      expect(document.querySelector(".nav-identity")).toBeNull();
    });

    it("omits the slot while the registry is still loading", () => {
      registryMock = { info: null, loading: true };
      renderWithProviders(<Navigation />);

      expect(document.querySelector(".nav-identity")).toBeNull();
    });
  });

  describe("with the librarian nav flag off", () => {
    it("hides the librarian links even from a music director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Card Catalog")).toBeInTheDocument();
      });

      expect(screen.queryByText("Music Department")).not.toBeInTheDocument();
      expect(screen.queryByText("Missing Releases")).not.toBeInTheDocument();
      expect(screen.queryByText("Rotation")).not.toBeInTheDocument();
    });
  });

  describe("with the librarian nav flag on", () => {
    beforeEach(() => {
      process.env[FLAG] = "true";
    });

    it("shows every librarian link to a music director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Music Department")).toBeInTheDocument();
      });
      expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      expect(screen.getByText("Rotation")).toBeInTheDocument();
    });

    // The catalog entry point moved onto the Music Department menu under the
    // JSP's own label. Its invented bar label must not survive alongside it.
    it("no longer carries the invented Add/Modify Catalog label", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Music Department")).toBeInTheDocument();
      });
      expect(screen.queryByText("Add/Modify Catalog")).not.toBeInTheDocument();
    });

    // Marking a release missing or found is deliberately DJ-accessible, and so
    // is reading the rotation list — both sit outside tubafrenzy's admin check.
    it("shows missing releases and rotation to a plain DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      });
      expect(screen.getByText("Rotation")).toBeInTheDocument();
    });

    it("hides the catalog edit entry point from a plain DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      });
      expect(screen.queryByText("Music Department")).not.toBeInTheDocument();
    });

    // Only one entry may be highlighted at a time. `isActive` matched every
    // link whose path prefixed the URL, so a library sub-screen lit both its
    // own entry and the catalog entry point at once; longest-match is what
    // makes the bar name a single location.
    describe("active highlighting", () => {
      const activeLabels = (container: HTMLElement) =>
        Array.from(container.querySelectorAll("a.active")).map((a) => a.textContent);

      it.each([
        { pathname: "/dashboard/library/missing", expected: "Missing Releases" },
        { pathname: "/dashboard/library", expected: "Music Department" },
        { pathname: "/dashboard/library/release/12", expected: "Music Department" },
        { pathname: "/dashboard/md", expected: "Music Department" },
        { pathname: "/dashboard/rotation", expected: "Rotation" },
        { pathname: "/dashboard/rotation/new", expected: "Rotation" },
        { pathname: "/dashboard/catalog", expected: "Card Catalog" },
      ])("highlights only $expected on $pathname", async ({ pathname, expected }) => {
        currentPathname = pathname;
        mockFetchOrgRole.mockResolvedValue("musicDirector");
        const { container } = renderWithProviders(<Navigation />);

        await waitFor(() => {
          expect(screen.getByText("Music Department")).toBeInTheDocument();
        });

        expect(activeLabels(container)).toEqual([expected]);
      });

      // A DJ has no Music Department entry, so the library screens claim
      // nothing in his bar rather than falling back to a neighbour.
      it("highlights nothing for a DJ on a library screen", async () => {
        currentPathname = "/dashboard/library/release/12";
        mockFetchOrgRole.mockResolvedValue("dj");
        const { container } = renderWithProviders(<Navigation />);

        await waitFor(() => {
          expect(screen.getByText("Missing Releases")).toBeInTheDocument();
        });

        expect(activeLabels(container)).toEqual([]);
      });
    });

    it("leaves no empty list item behind when a link is withheld", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      const { container } = renderWithProviders(<Navigation />);

      await waitFor(() => {
        expect(screen.getByText("Missing Releases")).toBeInTheDocument();
      });

      const empty = Array.from(container.querySelectorAll("li")).filter(
        (item) => item.textContent?.trim() === ""
      );
      expect(empty).toHaveLength(0);
    });
  });
});

describe("Navigation — hydrating with a session the server could not see", () => {
  // The identity slot is the one part of this bar that depends on who is signed
  // in, and the session is a client-side read: better-auth resolves it from a
  // cookie through its own store, which does not exist while the page is being
  // rendered on the server. The server therefore always renders the bar with no
  // identity, and a signed-in browser renders one on its very first pass — so
  // every list item after it shifts by one, and React discards the whole
  // subtree and rebuilds it. Recoverable, but it is a real console error on
  // every classic page for every signed-in DJ.
  it("renders the same list on the server and on the first client pass", () => {
    // The asymmetry is the whole point, so it is staged rather than mocked
    // flat: the server renders with no session resolved, because better-auth's
    // store does not exist there, and the browser hydrates with one already in
    // hand. A single mock value for both passes cannot reproduce this and the
    // test would pass against the unfixed component.
    registryMock = { info: null, loading: true };
    const serverHtml = renderToString(<Navigation />);

    registryMock = {
      info: { id: "u1", real_name: "Test User" },
      loading: false,
    };

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    // `onRecoverableError` is React's own report of a hydration mismatch, so
    // this asserts the condition rather than the shape of a console message.
    const recoverable: string[] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let root!: ReturnType<typeof hydrateRoot>;
    act(() => {
      root = hydrateRoot(container, <Navigation />, {
        onRecoverableError: (error) => {
          recoverable.push(String(error));
        },
      });
    });

    errorSpy.mockRestore();

    // Both halves matter. Hiding the identity permanently would satisfy the
    // mismatch assertion on its own, and would also delete the feature: the
    // slot exists so a shared control-room browser says whose session is open.
    expect(recoverable).toEqual([]);
    expect(container.querySelector(".nav-identity")?.textContent).toBe(
      "Test User",
    );

    act(() => root.unmount());
    container.remove();
  });
});
