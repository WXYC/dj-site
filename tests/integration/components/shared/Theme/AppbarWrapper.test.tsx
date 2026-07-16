import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub the two appbars so tests can assert which one rendered without pulling
// in their full dependency trees.
vi.mock("@/src/components/shared/Theme/Appbar", () => ({
  default: () => <div data-testid="appbar-modern" />,
}));
vi.mock("@/src/components/shared/Theme/AppbarClassic", () => ({
  default: () => <div data-testid="appbar-classic" />,
}));

import AppbarWrapper from "@/src/components/shared/Theme/AppbarWrapper";

describe("AppbarWrapper", () => {
  it("renders the classic appbar when the server-resolved experience is classic", () => {
    // Regression guard for the modern→classic flash: the server-resolved prop
    // drives the render synchronously — no transient modern appbar.
    render(<AppbarWrapper experience="classic" />);

    expect(screen.getByTestId("appbar-classic")).toBeInTheDocument();
    expect(screen.queryByTestId("appbar-modern")).not.toBeInTheDocument();
  });

  it("renders the modern appbar when the server-resolved experience is modern", () => {
    render(<AppbarWrapper experience="modern" />);

    expect(screen.getByTestId("appbar-modern")).toBeInTheDocument();
    expect(screen.queryByTestId("appbar-classic")).not.toBeInTheDocument();
  });
});
