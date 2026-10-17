import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { renderWithProviders } from "@/tests/helpers/render";
import PageTabs, { type PageTab } from "@/src/components/experiences/modern/PageTabs";

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
    { name: "no count", tab: { path: "/dashboard/first", label: "First" } satisfies PageTab, pill: null },
    { name: "a zero count", tab: { path: "/dashboard/first", label: "First", count: 0, countLabel: "0 waiting" } satisfies PageTab, pill: null },
    { name: "a count of 1", tab: { path: "/dashboard/first", label: "First", count: 1, countLabel: "1 waiting" } satisfies PageTab, pill: "1" },
    { name: "a count of 12", tab: { path: "/dashboard/first", label: "First", count: 12, countLabel: "12 waiting" } satisfies PageTab, pill: "12" },
  ])("draws the right pill for $name", ({ tab, pill }) => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/first");

    renderWithProviders(<PageTabs tabs={[tab]} />);

    const link = screen.getByRole("link", { name: /^First/ });
    expect(link).toHaveTextContent(pill === null ? /^First$/ : new RegExp(`^First${pill}, ${tab.count} waiting$`));
    expect(link).toHaveAccessibleName(pill === null ? "First" : `First, ${tab.count} waiting`);
  });

  it("hides the visible pill from assistive technology and speaks the count from text inside the tab", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/first");

    renderWithProviders(<PageTabs tabs={[{ path: "/dashboard/first", label: "First", count: 12, countLabel: "12 waiting" }]} />);

    const link = screen.getByRole("link", { name: "First, 12 waiting" });
    // The name comes from content, not from an aria-label on a role-less element, which ARIA 1.2 prohibits.
    expect(link.querySelector("[aria-label]")).toBeNull();
    expect(screen.getByText("12")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(", 12 waiting")).not.toHaveAttribute("aria-hidden");
  });

  it("requires a countLabel whenever a count is given, so the digits never run into the label", () => {
    // @ts-expect-error a count with no countLabel is a type error
    const withoutLabel: PageTab = { path: "/dashboard/first", label: "First", count: 12 };
    // @ts-expect-error a countLabel with no count is a type error
    const withoutCount: PageTab = { path: "/dashboard/first", label: "First", countLabel: "12 waiting" };

    expect([withoutLabel, withoutCount]).toHaveLength(2);
  });
});
