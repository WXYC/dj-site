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

  it("should show all four pills (no overflow) so format stays visible", () => {
    renderWithProviders(
      <ReleaseChips genre="Jazz" format="Vinyl" rotation="H" onStreaming={false} />
    );

    // All four wrap; format (Vinyl vs CD) is never folded away.
    expect(screen.getByText("Jazz")).toBeDefined();
    expect(screen.getByText("Vinyl")).toBeDefined();
    expect(screen.getByText("H")).toBeDefined();
    expect(screen.getByText("WXYC EXCLUSIVE")).toBeDefined();
    expect(screen.queryByText("+1")).toBeNull();
  });

  it("should preserve casing on arbitrary format strings", () => {
    renderWithProviders(
      <ReleaseChips genre="Rock" format={"CD-R" as never} onStreaming={undefined} />
    );
    // Not case-mangled to "Cd-r".
    expect(screen.getByText("CD-R")).toBeDefined();
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
