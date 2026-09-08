import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/playlists",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: () => ({ handleLogout: vi.fn() }),
}));

import ClassicPreviousSetsSurface from "@/src/components/experiences/classic/playlists/ClassicPreviousSetsSurface";

describe("ClassicPreviousSetsSurface", () => {
  // Every other classic dashboard screen reaches Navigation through a shell
  // component. This surface owns it directly rather than borrowing
  // Layout/Main, whose `textAlign: center` would re-centre the week grid, so
  // nothing above it guarantees the bar is on the page.
  it("renders the classic navigation bar", () => {
    renderWithProviders(<ClassicPreviousSetsSurface />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Card Catalog" })
    ).toBeInTheDocument();
  });
});
