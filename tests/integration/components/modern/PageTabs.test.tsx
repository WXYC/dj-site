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

  it.each([
    { name: "no count", count: undefined, pill: null },
    { name: "a zero count", count: 0, pill: null },
    { name: "a count of 1", count: 1, pill: "1" },
    { name: "a count of 12", count: 12, pill: "12" },
  ])("draws the right pill for $name", ({ count, pill }) => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/first");

    renderWithProviders(<PageTabs tabs={[{ path: "/dashboard/first", label: "First", count, countLabel: `${count} waiting` }]} />);

    const link = screen.getByRole("link", { name: /^First/ });
    expect(link).toHaveTextContent(pill === null ? /^First$/ : new RegExp(`^First${pill}$`));
    expect(link).toHaveAccessibleName(pill === null ? "First" : `First, ${count} waiting`);
  });
});
