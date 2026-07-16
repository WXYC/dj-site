import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The live experience query is mocked so each test controls whether API data
// is present. Default: no data loaded yet (the first-paint scenario).
vi.mock("@/lib/features/experiences/api", () => ({
  useGetActiveExperienceQuery: vi.fn(() => ({ data: undefined })),
}));

// Stub the two appbars so tests can assert which one rendered without pulling
// in their full dependency trees.
vi.mock("@/src/components/shared/Theme/Appbar", () => ({
  default: () => <div data-testid="appbar-modern" />,
}));
vi.mock("@/src/components/shared/Theme/AppbarClassic", () => ({
  default: () => <div data-testid="appbar-classic" />,
}));

import AppbarWrapper from "@/src/components/shared/Theme/AppbarWrapper";
import { useGetActiveExperienceQuery } from "@/lib/features/experiences/api";

describe("AppbarWrapper", () => {
  beforeEach(() => {
    // Reset to "no API data yet" before each test.
    vi.mocked(useGetActiveExperienceQuery).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useGetActiveExperienceQuery>);
  });

  it("renders the classic appbar on first paint when the server-resolved experience is classic", () => {
    // Regression guard for the modern→classic flash: with no live API data yet,
    // the server-resolved prop must drive the very first render synchronously —
    // no transient modern appbar.
    render(<AppbarWrapper experience="classic" />);

    expect(screen.getByTestId("appbar-classic")).toBeInTheDocument();
    expect(screen.queryByTestId("appbar-modern")).not.toBeInTheDocument();
  });

  it("renders the modern appbar when the server-resolved experience is modern", () => {
    render(<AppbarWrapper experience="modern" />);

    expect(screen.getByTestId("appbar-modern")).toBeInTheDocument();
    expect(screen.queryByTestId("appbar-classic")).not.toBeInTheDocument();
  });

  it("prefers the live API experience over the server-resolved prop once it loads", () => {
    // Existing behavior: a runtime experience switch (reflected by the API)
    // wins over the SSR snapshot, so switching does not require a reload.
    vi.mocked(useGetActiveExperienceQuery).mockReturnValue({
      data: "modern",
    } as unknown as ReturnType<typeof useGetActiveExperienceQuery>);

    render(<AppbarWrapper experience="classic" />);

    expect(screen.getByTestId("appbar-modern")).toBeInTheDocument();
    expect(screen.queryByTestId("appbar-classic")).not.toBeInTheDocument();
  });
});
