import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AutoDJBanner from "./AutoDJBanner";
import { useAutoDJStatus } from "@/lib/features/autoDJ/hooks";
import type { AutoDJStatus } from "@/lib/features/autoDJ/types";

vi.mock("@/lib/features/autoDJ/hooks", () => ({ useAutoDJStatus: vi.fn() }));
const mockStatus = vi.mocked(useAutoDJStatus);

describe("AutoDJBanner", () => {
  beforeEach(() => mockStatus.mockReset());

  it("renders nothing when auto-DJ is inactive", () => {
    mockStatus.mockReturnValue({ active: false } as AutoDJStatus);
    const { container } = render(<AutoDJBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no status yet", () => {
    mockStatus.mockReturnValue(undefined);
    const { container } = render(<AutoDJBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the 'Auto DJ Enabled' message and current track when active", () => {
    mockStatus.mockReturnValue({
      active: true,
      currentTrack: {
        artist: "Juana Molina",
        title: "la paradoja",
        album: "DOGA",
        detectedAt: "2026-03-07T23:42:18Z",
      },
    } as AutoDJStatus);
    render(<AutoDJBanner />);
    expect(screen.getByText("Auto DJ Enabled")).toBeTruthy();
    expect(screen.getByText(/Juana Molina/)).toBeTruthy();
    expect(screen.getByText(/la paradoja/)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders the message without a track when none is detected yet", () => {
    mockStatus.mockReturnValue({
      active: true,
      currentTrack: null,
    } as AutoDJStatus);
    render(<AutoDJBanner />);
    expect(screen.getByText("Auto DJ Enabled")).toBeTruthy();
  });
});
