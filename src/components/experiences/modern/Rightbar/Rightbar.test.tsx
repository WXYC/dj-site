import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, createTestStore } from "@/lib/test-utils";
import { applicationSlice } from "@/lib/features/application/frontend";
import { createTestAccountResult } from "@/lib/test-utils";
import Rightbar from "./Rightbar";

// Mock child components
vi.mock("./RightbarMobileClose", () => ({
  default: () => <div data-testid="rightbar-mobile-close">Mobile Close</div>,
}));

vi.mock("./RightbarContainer", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rightbar-container">{children}</div>
  ),
}));

vi.mock("./NowPlayingContent", () => ({
  default: () => <div data-testid="now-playing-content">Now Playing</div>,
}));

vi.mock("./Bin/BinContent", () => ({
  default: () => <div data-testid="bin-content">Bin Content</div>,
}));

vi.mock("./panels/AlbumDetailPanel", () => ({
  default: ({ albumId }: { albumId: number }) => <div data-testid="album-detail-panel">Album {albumId}</div>,
}));

vi.mock("./panels/SettingsPanel", () => ({
  default: () => <div data-testid="settings-panel">Settings</div>,
}));

vi.mock("./panels/AccountEditPanel", () => ({
  default: () => <div data-testid="account-edit-panel">Account Edit</div>,
}));

// Mock MUI components
vi.mock("@mui/joy", () => ({
  Box: ({ children, sx }: { children?: React.ReactNode; sx?: any }) => (
    <div data-testid="box" style={{ minHeight: sx?.minHeight }}>
      {children}
    </div>
  ),
  Divider: () => <hr data-testid="divider" />,
}));

vi.mock("@/src/widgets/NowPlaying", () => ({
  default: () => <div data-testid="now-playing-widget">Widget</div>,
}));

describe("Rightbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render default content with NowPlaying and Bin", () => {
    renderWithProviders(<Rightbar />);

    expect(screen.getByTestId("rightbar-mobile-close")).toBeInTheDocument();
    expect(screen.getByTestId("rightbar-container")).toBeInTheDocument();
    expect(screen.getByTestId("now-playing-content")).toBeInTheDocument();
    expect(screen.getByTestId("bin-content")).toBeInTheDocument();
    expect(screen.getAllByTestId("divider")).toHaveLength(2);
    expect(screen.getByTestId("box")).toBeInTheDocument();
  });

  it("should render components in correct order within container", () => {
    renderWithProviders(<Rightbar />);

    const container = screen.getByTestId("rightbar-container");
    const children = container.children;

    expect(children[0]).toHaveAttribute("data-testid", "now-playing-content");
    expect(children[1]).toHaveAttribute("data-testid", "divider");
    expect(children[2]).toHaveAttribute("data-testid", "bin-content");
    expect(children[3]).toHaveAttribute("data-testid", "divider");
    expect(children[4]).toHaveAttribute("data-testid", "box");
  });

  it("should render album detail panel when panel type is album-detail", () => {
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: 42 }));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("album-detail-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("now-playing-content")).not.toBeInTheDocument();
  });

  it("should render settings panel when panel type is settings", () => {
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.openPanel({ type: "settings" }));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("now-playing-content")).not.toBeInTheDocument();
  });

  it("should render account edit panel when panel type is account-edit", () => {
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.openPanel({
      type: "account-edit",
      account: createTestAccountResult(),
      isSelf: false,
      organizationSlug: "wxyc",
    }));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("account-edit-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("now-playing-content")).not.toBeInTheDocument();
  });

  it("should render mobile close before container", () => {
    renderWithProviders(<Rightbar />);

    const mobileClose = screen.getByTestId("rightbar-mobile-close");
    const container = screen.getByTestId("rightbar-container");

    expect(mobileClose.compareDocumentPosition(container)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
