import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

vi.mock("server-only", () => ({}));

const mockCreateServerSideProps = vi.fn();
vi.mock("@/lib/features/session", () => ({
  createServerSideProps: () => mockCreateServerSideProps(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/some-other-slot",
}));

const mockSwitchExperience = vi.fn();
const mockUseExperienceSwitch = vi.fn();
vi.mock("@/src/hooks/experienceSwitchHooks", () => ({
  useExperienceSwitch: (args: unknown) => {
    mockUseExperienceSwitch(args);
    return { switchExperience: mockSwitchExperience, pending: false };
  },
}));

vi.mock("@/src/components/experiences/classic/Navigation", () => ({
  default: () => <nav data-testid="classic-nav" />,
}));

import ClassicDefault from "@/app/dashboard/@classic/default";
import ModernDefault from "@/app/dashboard/@modern/default";

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateServerSideProps.mockResolvedValue({
    application: {
      experience: "classic",
      colorMode: "dark",
      themeId: "bluenote",
      rightBarMini: true,
    },
  });
});

// Both slots render for every /dashboard URL. A slot with no page for the
// current URL falls through here, and returning null paints an empty container
// that is indistinguishable from a broken page.
describe("dashboard slot defaults", () => {
  describe("classic slot", () => {
    it("renders a way into the modern experience rather than nothing", async () => {
      renderWithProviders(await ClassicDefault());

      expect(
        screen.getByRole("button", { name: /switch to the modern interface/i })
      ).toBeInTheDocument();
      expect(mockUseExperienceSwitch).toHaveBeenCalledWith(
        expect.objectContaining({ target: "modern" })
      );
    });

    // The classic slot has no layout.tsx, so an unmatched URL would otherwise
    // paint with no navigation and no way back to a working screen.
    it("carries its own navigation", async () => {
      renderWithProviders(await ClassicDefault());

      expect(screen.getByTestId("classic-nav")).toBeInTheDocument();
    });

    it("names the URL that has no classic version", async () => {
      renderWithProviders(await ClassicDefault());

      expect(
        screen.getByText("/dashboard/some-other-slot")
      ).toBeInTheDocument();
    });
  });

  describe("modern slot", () => {
    it("renders a way into the classic experience rather than nothing", async () => {
      renderWithProviders(await ModernDefault());

      expect(
        screen.getByRole("button", { name: /switch to the classic interface/i })
      ).toBeInTheDocument();
      expect(mockUseExperienceSwitch).toHaveBeenCalledWith(
        expect.objectContaining({ target: "classic" })
      );
    });

    it("names the URL that has no modern version", async () => {
      renderWithProviders(await ModernDefault());

      expect(
        screen.getByText("/dashboard/some-other-slot")
      ).toBeInTheDocument();
    });
  });

  // Switching experiences must not silently reset the viewer's colour mode or
  // discard the modern theme they picked.
  it.each([
    ["classic", ClassicDefault],
    ["modern", ModernDefault],
  ])(
    "carries colour mode and theme across the switch (%s slot)",
    async (_slot, Slot) => {
      renderWithProviders(await Slot());

      expect(mockUseExperienceSwitch).toHaveBeenCalledWith(
        expect.objectContaining({ colorMode: "dark", themeId: "bluenote" })
      );
    }
  );
});
