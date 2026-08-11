import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/features/authentication/server-utils", () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
  requireRole: vi.fn().mockResolvedValue(undefined),
}));

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

import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";
import Main from "@/src/components/experiences/modern/Main";
import CatalogAdminPage from "@/app/dashboard/@modern/admin/catalog/page";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

function session() {
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

// jsdom's cascade does not expand the `overflow` shorthand into `overflowY`, so
// an element styled `overflow: auto` reports overflowY as `visible`. Read both.
function scrollsVertically(element: Element): boolean {
  const { overflow, overflowY } = window.getComputedStyle(element);
  return [overflow, overflowY].some(
    (value) => value === "auto" || value === "scroll",
  );
}

function nearestScrollableAncestor(from: Element): Element | null {
  let node: Element | null = from.parentElement;
  while (node) {
    if (scrollsVertically(node)) return node;
    node = node.parentElement;
  }
  return null;
}

describe("catalog admin page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session());
    mockFetchOrgRole.mockResolvedValue("musicDirector");
  });

  // The dashboard's Main region is a fixed 100dvh box with overflow:hidden, so
  // a page that supplies no scroll container of its own is not merely missing a
  // scrollbar — everything past the fold is unreachable. The genre add form sits
  // below a list that grows without bound, which is exactly what gets clipped.
  // Rendering inside the real Main is what makes this assertable; the page in
  // isolation looks fine no matter what it does.
  it("scrolls its own content, since Main clips at viewport height", async () => {
    const page = await CatalogAdminPage();
    renderWithProviders(<Main>{page}</Main>);

    const genreHeading = await screen.findByText("Genres");
    const scroller = nearestScrollableAncestor(genreHeading);

    expect(scroller).not.toBeNull();
    // The scroller has to span both cards, not just the one that overflows:
    // scrolling Genres alone would still strand Formats against a clipped edge.
    expect(scroller).toContainElement(screen.getByText("Formats"));
  });

  it("keeps both add forms mounted below their lists", async () => {
    const page = await CatalogAdminPage();
    renderWithProviders(<Main>{page}</Main>);

    expect(
      await screen.findByRole("button", { name: /add format/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /add genre/i }),
    ).toBeInTheDocument();
  });
});
