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

  it("should collapse past three pills into a +N overflow chip", () => {
    renderWithProviders(
      <ReleaseChips genre="Jazz" format="Vinyl" rotation="H" onStreaming={false} />
    );

    // format is lowest priority: folded into the overflow chip
    expect(screen.getByText("Jazz")).toBeDefined();
    expect(screen.getByText("H")).toBeDefined();
    expect(screen.getByText("WXYC EXCLUSIVE")).toBeDefined();
    expect(screen.queryByText("Vinyl")).toBeNull();
    expect(screen.getByText("+1")).toBeDefined();
  });

  it("should render the rotation pill only when a rotation is provided", () => {
    const { unmount } = renderWithProviders(
      <ReleaseChips genre="Jazz" format="Vinyl" rotation="H" onStreaming={undefined} />
    );
    expect(screen.getByText("H")).toBeDefined();
    unmount();

    renderWithProviders(
      <ReleaseChips genre="Jazz" format="Vinyl" onStreaming={undefined} />
    );
    expect(screen.queryByText("H")).toBeNull();
  });
});
