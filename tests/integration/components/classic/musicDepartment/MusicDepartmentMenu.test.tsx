import { describe, it, expect, vi, beforeEach } from "vitest";
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

beforeEach(() => {
  mockHandleLogout.mockClear();
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
    /cross-reference/i,
    /manage labels/i,
    /rebuild search indexes/i,
    /admin settings/i,
  ])("omits the entry matching %s", (pattern) => {
    const { container } = renderWithProviders(<MusicDepartmentMenu />);

    expect(within(container).queryByText(pattern)).not.toBeInTheDocument();
  });
});
