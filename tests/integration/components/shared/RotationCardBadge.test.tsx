import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { renderWithModernTheme as renderWithProviders } from "@/tests/helpers/renderModern";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";

describe("RotationCardBadge", () => {
  it("renders the card number", () => {
    renderWithProviders(<RotationCardBadge number={2} bin="L" />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders a number greater than 20 — proving it is not a Unicode circled digit", () => {
    // The circled-digit glyphs (①–⑳) stop at 20; a CSS circle has no such
    // ceiling, so a two-digit card must render verbatim.
    renderWithProviders(<RotationCardBadge number={42} bin="L" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders a three-digit number verbatim", () => {
    renderWithProviders(<RotationCardBadge number={128} bin="L" />);
    expect(screen.getByText("128")).toBeInTheDocument();
  });

  it("is aria-hidden so it adds no bare number to the accessible name", () => {
    renderWithProviders(<RotationCardBadge number={7} bin="L" />);
    expect(screen.getByText("7")).toHaveAttribute("aria-hidden", "true");
  });

  it("fills by bin — two bins render with different styling", () => {
    // The circle wears its bin's palette hue, so a Heavy card and a Light card
    // are visually distinct. Joy compiles each distinct fill to its own style
    // class, so different bins carry different classes.
    renderWithProviders(
      <>
        <RotationCardBadge number={1} bin="H" />
        <RotationCardBadge number={2} bin="L" />
      </>,
    );
    expect(screen.getByText("1").className).not.toEqual(screen.getByText("2").className);
  });
});
