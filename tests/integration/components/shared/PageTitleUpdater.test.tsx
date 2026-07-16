import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePathname } from "next/navigation";
import { renderWithProviders } from "@/tests/helpers";
import { getPageTitle } from "@/lib/utils/page-title";
import PageTitleUpdater from "@/src/components/shared/PageTitleUpdater";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

/**
 * One-writer-per-route contract (#640 follow-up): PageTitleUpdater owns titles
 * only for its explicitly-mapped routes; everywhere else it must skip so the
 * route's own writer (PageHeader in the modern experience) is never fought.
 */
describe("PageTitleUpdater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = "untouched-sentinel";
  });

  it("sets the title for a mapped route without PageHeader", () => {
    vi.mocked(usePathname).mockReturnValue("/login");

    renderWithProviders(<PageTitleUpdater />);

    expect(document.title).toBe(getPageTitle("Login"));
  });

  it("maps exactly '/' without acting as a universal prefix", () => {
    vi.mocked(usePathname).mockReturnValue("/");

    renderWithProviders(<PageTitleUpdater />);

    expect(document.title).toBe(getPageTitle("DJ Site"));
  });

  it("skips an unmapped route entirely", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/playlists");

    renderWithProviders(<PageTitleUpdater />);

    expect(document.title).toBe("untouched-sentinel");
  });

  it("prefix-matches a mapped route at a segment boundary", () => {
    vi.mocked(usePathname).mockReturnValue("/onboarding/step");

    renderWithProviders(<PageTitleUpdater />);

    expect(document.title).toBe(getPageTitle("Onboarding"));
  });

  it("lets PageHeader own the title on an unmapped route, surviving a pathname-effect refire", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/playlists");

    const { rerender } = renderWithProviders(
      <>
        <PageTitleUpdater />
        <PageHeader title="Previous Sets" />
      </>,
    );

    expect(document.title).toBe(getPageTitle("Previous Sets"));

    // Refire PageTitleUpdater's pathname effect on another unmapped route;
    // PageHeader's [title] dep is unchanged, so any overwrite here would come
    // from the catch-all this component must no longer have.
    vi.mocked(usePathname).mockReturnValue("/dashboard/playlists/archive");
    rerender(
      <>
        <PageTitleUpdater />
        <PageHeader title="Previous Sets" />
      </>,
    );

    expect(document.title).toBe(getPageTitle("Previous Sets"));
  });
});
