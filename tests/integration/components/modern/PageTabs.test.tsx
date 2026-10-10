import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { renderWithProviders } from "@/tests/helpers/render";
import PageTabs from "@/src/components/experiences/modern/PageTabs";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const TABS = [
  { path: "/dashboard/first", label: "First" },
  { path: "/dashboard/first/second", label: "Second" },
];

describe("PageTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { pathname: "/dashboard/first", current: "First" },
    { pathname: "/dashboard/first/second", current: "Second" },
    { pathname: "/dashboard/first/second/deeper", current: null },
    { pathname: "/dashboard/elsewhere", current: null },
  ])("marks $current current on $pathname", ({ pathname, current }) => {
    vi.mocked(usePathname).mockReturnValue(pathname);

    renderWithProviders(<PageTabs tabs={TABS} />);

    for (const tab of TABS) {
      const link = screen.getByRole("link", { name: tab.label });
      expect(link).toHaveAttribute("href", tab.path);
      if (tab.label === current) {
        expect(link).toHaveAttribute("aria-current", "page");
      } else {
        expect(link).not.toHaveAttribute("aria-current");
      }
    }
  });
});
