import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import MusicDepartmentMenu from "@/src/components/experiences/classic/musicDepartment/MusicDepartmentMenu";

// Labels are asserted verbatim rather than by pattern: divergence from the
// JSP's own wording is the failure mode this screen exists to avoid, so a
// reworded link must fail here rather than pass a fuzzy match.
describe("classic Music Department menu — musicmenu.jsp + libraryAdminLinks.jsp", () => {
  it.each([
    { label: "Create or Find Artists By Library Code", href: "/dashboard/library" },
    { label: "Missing Releases", href: "/dashboard/library/missing" },
    { label: "Rotation Releases", href: "/dashboard/rotation" },
    { label: "Add Rotation Releases", href: "/dashboard/rotation/new" },
  ])("links $label to $href", ({ label, href }) => {
    renderWithProviders(<MusicDepartmentMenu />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("carries musicmenu.jsp's own heading", () => {
    renderWithProviders(<MusicDepartmentMenu />);

    expect(screen.getByText("WXYC Music Department application")).toBeInTheDocument();
  });

  it("renders the libraryAdminLinks.jsp search prompt", () => {
    renderWithProviders(<MusicDepartmentMenu />);

    expect(screen.getByText("Search for Artists & Releases:")).toBeInTheDocument();
  });

  // Format Tallysheets is musicmenu.jsp's third link. wiki#89 decision D5
  // drops the rotation tallysheet, so this screen must not grow a dead link
  // to it -- the same precedent MissingReleases set for a JSP link with no
  // dj-site destination.
  it("omits the dropped Format Tallysheets entry", () => {
    renderWithProviders(<MusicDepartmentMenu />);

    expect(screen.queryByText(/tallysheet/i)).not.toBeInTheDocument();
  });
});
