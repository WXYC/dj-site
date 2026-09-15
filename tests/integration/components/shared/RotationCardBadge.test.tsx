import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";

describe("RotationCardBadge", () => {
  it("renders the card number", () => {
    renderWithProviders(<RotationCardBadge number={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders a number greater than 20 — proving it is not a Unicode circled digit", () => {
    // The circled-digit glyphs (①–⑳) stop at 20; a CSS circle has no such
    // ceiling, so a two-digit card must render verbatim.
    renderWithProviders(<RotationCardBadge number={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders a three-digit number verbatim", () => {
    renderWithProviders(<RotationCardBadge number={128} />);
    expect(screen.getByText("128")).toBeInTheDocument();
  });

  it("is aria-hidden so it adds no bare number to the accessible name", () => {
    renderWithProviders(<RotationCardBadge number={7} />);
    expect(screen.getByText("7")).toHaveAttribute("aria-hidden", "true");
  });
});
