import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AutoDJGreyscale from "./AutoDJGreyscale";
import { useAutoDJActive } from "@/lib/features/autoDJ/hooks";

vi.mock("@/lib/features/autoDJ/hooks", () => ({ useAutoDJActive: vi.fn() }));
const mockActive = vi.mocked(useAutoDJActive);

describe("AutoDJGreyscale", () => {
  beforeEach(() => mockActive.mockReset());

  it("marks the shell active and applies a greyscale filter when auto-DJ is on", () => {
    mockActive.mockReturnValue(true);
    render(
      <AutoDJGreyscale>
        <span>content</span>
      </AutoDJGreyscale>,
    );
    const shell = screen.getByText("content").parentElement!;
    expect(shell.getAttribute("data-auto-dj-active")).toBe("true");
    expect(shell.style.filter).toBe("grayscale(1)");
  });

  it("does not greyscale when auto-DJ is off", () => {
    mockActive.mockReturnValue(false);
    render(
      <AutoDJGreyscale>
        <span>content</span>
      </AutoDJGreyscale>,
    );
    const shell = screen.getByText("content").parentElement!;
    expect(shell.getAttribute("data-auto-dj-active")).toBe("false");
    expect(shell.style.filter).toBe("none");
  });
});
