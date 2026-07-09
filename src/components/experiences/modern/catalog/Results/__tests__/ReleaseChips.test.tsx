import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";

import { ReleaseChips } from "../ReleaseChips";

describe("ReleaseChips", () => {
  it("should render genre and format chips", () => {
    renderWithProviders(
      <ReleaseChips genre="Rock" format="Vinyl" onStreaming={undefined} />
    );

    expect(screen.getByText("Rock")).toBeDefined();
    expect(screen.getByText("Vinyl")).toBeDefined();
  });

  it("should render the WXYC EXCLUSIVE chip only when onStreaming is false", () => {
    const { unmount } = renderWithProviders(
      <ReleaseChips genre="Electronic" format="CD" onStreaming={false} />
    );
    expect(screen.getByText("WXYC EXCLUSIVE")).toBeDefined();
    unmount();

    renderWithProviders(
      <ReleaseChips genre="Electronic" format="CD" onStreaming={true} />
    );
    expect(screen.queryByText("WXYC EXCLUSIVE")).toBeNull();
  });

  it("should wrap chips instead of forcing one line", () => {
    renderWithProviders(
      <ReleaseChips genre="Jazz" format="Vinyl" onStreaming={false} />
    );

    const stack = screen.getByText("Jazz").closest(".MuiStack-root");
    expect(stack).not.toBeNull();
    expect(getComputedStyle(stack!).flexWrap).toBe("wrap");
  });
});
