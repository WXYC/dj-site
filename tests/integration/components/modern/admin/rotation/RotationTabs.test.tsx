import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import RotationTabs from "@/src/components/experiences/modern/admin/rotation/RotationTabs";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard/admin/rotation"),
}));

describe("RotationTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a link for each of the three rotation routes", async () => {
    renderWithProviders(<RotationTabs />);

    expect(screen.getByRole("link", { name: "Add to rotation" })).toHaveAttribute(
      "href",
      "/dashboard/admin/rotation/new"
    );
    expect(screen.getByRole("link", { name: "Rotation list" })).toHaveAttribute(
      "href",
      "/dashboard/admin/rotation"
    );
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute(
      "href",
      "/dashboard/admin/rotation/cards"
    );
  });

  it("marks the list tab current when on the list route", async () => {
    renderWithProviders(<RotationTabs />);

    expect(screen.getByRole("link", { name: "Rotation list" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Add to rotation" })
    ).not.toHaveAttribute("aria-current");
  });

  it("marks the bench tab current when on the new route", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/admin/rotation/new");

    renderWithProviders(<RotationTabs />);

    expect(
      screen.getByRole("link", { name: "Add to rotation" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Rotation list" })
    ).not.toHaveAttribute("aria-current");
  });

  it("marks the cards tab current when on the cards route", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/admin/rotation/cards");

    renderWithProviders(<RotationTabs />);

    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
