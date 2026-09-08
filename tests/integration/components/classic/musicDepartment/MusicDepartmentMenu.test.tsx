import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockHandleLogout = vi.fn();

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: () => ({ handleLogout: mockHandleLogout, loggingOut: false }),
}));

import MusicDepartmentMenu from "@/src/components/experiences/classic/musicDepartment/MusicDepartmentMenu";

const CROSSREFERENCES_FLAG = "NEXT_PUBLIC_CLASSIC_CROSSREFERENCES_ENABLED";

beforeEach(() => {
  mockHandleLogout.mockClear();
});

afterEach(() => {
  delete process.env[CROSSREFERENCES_FLAG];
});

// Labels are asserted verbatim rather than by pattern: divergence from the
// JSP's own wording is the failure mode this screen exists to avoid, so a
// reworded link must fail here rather than pass a fuzzy match.
describe("classic Music Department menu — mainmenu.jsp", () => {
  it.each([
    { label: "Add, Edit, & Delete Artists & Releases", href: "/dashboard/library" },
    { label: "Missing Releases", href: "/dashboard/library/missing" },
    { label: "Rotation Releases", href: "/dashboard/rotation" },
    { label: "Add Rotation Releases", href: "/dashboard/rotation/new" },
  ])("links $label to $href", ({ label, href }) => {
    renderWithProviders(<MusicDepartmentMenu />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  // The entry sequence, including the JSP's single `<p>&nbsp;</p>` — its only
  // vertical grouping, which sits after Missing Releases.
  it("renders the JSP's entries in order, with its one gap", () => {
    const { container } = renderWithProviders(<MusicDepartmentMenu />);

    const menu = container.querySelector("h3")!.parentElement!;

    expect(Array.from(menu.children).map((entry) => entry.textContent)).toEqual([
      "Add, Edit, & Delete Artists & Releases",
      "Missing Releases",
      "\u00a0",
      "Rotation Releases",
      "Add Rotation Releases",
      "Log Out",
    ]);
  });

  // `login?loginAction=endSession` in the JSP. dj-site has no such GET, so the
  // entry ends the session the same way the classic nav bar's Log Out does.
  it("ends the session from the Log Out entry", async () => {
    const { user } = renderWithProviders(<MusicDepartmentMenu />);

    await user.click(screen.getByRole("link", { name: "Log Out" }));

    expect(mockHandleLogout).toHaveBeenCalled();
  });

  it("renders the search prompt", () => {
    renderWithProviders(<MusicDepartmentMenu />);

    expect(screen.getByText("Search for Artists & Releases:")).toBeInTheDocument();
  });

  // `mainmenu.jsp` carries no on-page heading — its `<title>` is just `WXYC` —
  // so the search prompt is the only `.title` span on the screen.
  it("renders no heading above the search box", () => {
    const { container } = renderWithProviders(<MusicDepartmentMenu />);

    expect(
      Array.from(container.querySelectorAll(".title")).map((span) => span.textContent)
    ).toEqual(["Search for Artists & Releases:"]);
  });

  // Entries whose dj-site screens do not exist: the rotation tallysheet was
  // retired rather than rebuilt, and the rest are unbuilt. This screen must
  // not grow a dead link to any of them — the same precedent MissingReleases
  // set for a JSP link with no dj-site destination.
  it.each([
    /tallysheet/i,
    /manage labels/i,
    /rebuild search indexes/i,
    /admin settings/i,
  ])("omits the entry matching %s", (pattern) => {
    const { container } = renderWithProviders(<MusicDepartmentMenu />);

    expect(within(container).queryByText(pattern)).not.toBeInTheDocument();
  });
});

// `mainmenu.jsp` puts both cross-reference links between the add/edit/delete
// entry and Missing Releases, inside its `hasAdminAccess()` block. They are
// flag-gated because their Backend endpoints are not on a deployed backend
// yet: an entry that leads to a screen the API cannot answer is worse than no
// entry at all, and the librarian nav flag they would otherwise ride is
// already on in production.
describe("cross-reference entries", () => {
  it("omits both entries while the flag is off", () => {
    renderWithProviders(<MusicDepartmentMenu />);

    expect(
      screen.queryByRole("link", { name: /cross-references/i }),
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "View Library Code Cross-References",
      href: "/dashboard/library/crossreferences/artists",
    },
    {
      label: "View Library Release Cross-References",
      href: "/dashboard/library/crossreferences/releases",
    },
  ])("links $label to $href with the flag on", ({ label, href }) => {
    process.env[CROSSREFERENCES_FLAG] = "true";

    renderWithProviders(<MusicDepartmentMenu />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("places both entries where the JSP does, above Missing Releases", () => {
    process.env[CROSSREFERENCES_FLAG] = "true";

    const { container } = renderWithProviders(<MusicDepartmentMenu />);

    const menu = container.querySelector("h3")!.parentElement!;

    expect(Array.from(menu.children).map((entry) => entry.textContent)).toEqual([
      "Add, Edit, & Delete Artists & Releases",
      "View Library Code Cross-References",
      "View Library Release Cross-References",
      "Missing Releases",
      "\u00a0",
      "Rotation Releases",
      "Add Rotation Releases",
      "Log Out",
    ]);
  });
});
