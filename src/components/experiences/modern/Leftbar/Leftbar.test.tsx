import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Leftbar from "./Leftbar";
import { Authorization } from "@/lib/features/admin/types";
import type { User } from "@/lib/features/authentication/types";

// Mock server-side authentication utilities
const mockUser = {
  id: "test-user-id",
  username: "testuser",
  email: "test@example.com",
  realName: "Test User" as string | undefined,
  djName: "DJ Test" as string | undefined,
  authority: Authorization.DJ,
  name: "testuser",
  emailVerified: true,
  appSkin: undefined as string | undefined,
  createdAt: undefined as Date | undefined,
  updatedAt: undefined as Date | undefined,
} satisfies User;

vi.mock("@/lib/features/authentication/server-utils", () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: "123", name: "testuser", email: "test@example.com" },
      session: { id: "session-123" },
    })
  ),
  getUserFromSession: vi.fn(() => Promise.resolve(mockUser)),
}));

// Mock child components to simplify testing
vi.mock("./LeftbarContainer", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="leftbar-container">{children}</div>
  ),
}));

vi.mock("./LeftbarLink", () => ({
  default: ({
    path,
    title,
    disabled,
    children,
  }: {
    path: string;
    title: string;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <div
      data-testid={`leftbar-link-${path.replace(/\//g, "-")}`}
      data-disabled={disabled}
    >
      <span data-testid="link-title">{title}</span>
      {children}
    </div>
  ),
}));

vi.mock("./FlowsheetLink", () => ({
  default: () => <div data-testid="flowsheet-link">Flowsheet</div>,
}));

vi.mock("./LeftbarLogout", () => ({
  default: ({ user }: { user: User }) => (
    <div data-testid="leftbar-logout">{user.username}</div>
  ),
}));

// Mock MUI components
vi.mock("@mui/joy/List", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <ul data-testid="list">{children}</ul>
  ),
}));

vi.mock("@mui/joy/Divider", () => ({
  default: () => <hr data-testid="divider" />,
}));

// Mock MUI icons
vi.mock("@mui/icons-material/Album", () => ({
  default: () => <svg data-testid="album-icon" />,
}));

vi.mock("@mui/icons-material/Settings", () => ({
  default: () => <svg data-testid="settings-icon" />,
}));

vi.mock("@mui/icons-material/Storage", () => ({
  default: () => <svg data-testid="storage-icon" />,
}));

vi.mock("@mui/icons-material", () => ({
  EditCalendar: () => <svg data-testid="edit-calendar-icon" />,
  ManageAccounts: () => <svg data-testid="manage-accounts-icon" />,
}));

describe("Leftbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the leftbar container", async () => {
    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("leftbar-container")).toBeInTheDocument();
  });

  it("should render catalog link", async () => {
    const Component = await Leftbar();
    render(Component);

    const catalogLink = screen.getByTestId(
      "leftbar-link--dashboard-catalog"
    );
    expect(catalogLink).toBeInTheDocument();
    expect(screen.getByText("Card Catalog")).toBeInTheDocument();
  });

  it("should render flowsheet link", async () => {
    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("flowsheet-link")).toBeInTheDocument();
  });

  it("should render previous sets link as disabled", async () => {
    const Component = await Leftbar();
    render(Component);

    const playlistsLink = screen.getByTestId(
      "leftbar-link--dashboard-playlists"
    );
    expect(playlistsLink).toBeInTheDocument();
    expect(playlistsLink).toHaveAttribute("data-disabled", "true");
    expect(screen.getByText("Previous Sets")).toBeInTheDocument();
  });

  it("should render settings link", async () => {
    const Component = await Leftbar();
    render(Component);

    const settingsLink = screen.getByTestId(
      "leftbar-link--dashboard-settings"
    );
    expect(settingsLink).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should render logout component with user", async () => {
    const Component = await Leftbar();
    render(Component);

    const logout = screen.getByTestId("leftbar-logout");
    expect(logout).toBeInTheDocument();
    expect(logout).toHaveTextContent("testuser");
  });

  it("should not render admin links for DJ authority", async () => {
    const Component = await Leftbar();
    render(Component);

    // DJ users should not see admin links
    expect(
      screen.queryByTestId("leftbar-link--dashboard-admin-roster")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("leftbar-link--dashboard-admin-schedule")
    ).not.toBeInTheDocument();
  });

  it("should render admin links for MD authority", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.MD,
    });

    const Component = await Leftbar();
    render(Component);

    // MD users should see admin links
    expect(
      screen.getByTestId("leftbar-link--dashboard-admin-roster")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("leftbar-link--dashboard-admin-schedule")
    ).toBeInTheDocument();
  });

  it("should render admin links for SM authority", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.SM,
    });

    const Component = await Leftbar();
    render(Component);

    // SM users should see admin links
    expect(
      screen.getByTestId("leftbar-link--dashboard-admin-roster")
    ).toBeInTheDocument();
  });

  it("should disable roster link for MD authority (below SM)", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.MD,
    });

    const Component = await Leftbar();
    render(Component);

    const rosterLink = screen.getByTestId(
      "leftbar-link--dashboard-admin-roster"
    );
    expect(rosterLink).toHaveAttribute("data-disabled", "true");
  });

  it("should enable roster link for SM authority", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.SM,
    });

    const Component = await Leftbar();
    render(Component);

    const rosterLink = screen.getByTestId(
      "leftbar-link--dashboard-admin-roster"
    );
    expect(rosterLink).toHaveAttribute("data-disabled", "false");
  });

  it("should always disable schedule link", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.SM,
    });

    const Component = await Leftbar();
    render(Component);

    const scheduleLink = screen.getByTestId(
      "leftbar-link--dashboard-admin-schedule"
    );
    expect(scheduleLink).toHaveAttribute("data-disabled", "true");
  });

  it("should render dividers", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.SM,
    });

    const Component = await Leftbar();
    render(Component);

    // Should have dividers between sections
    expect(screen.getAllByTestId("divider").length).toBeGreaterThan(0);
  });

  it("should render list component", async () => {
    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("list")).toBeInTheDocument();
  });

  it("should render album icon for catalog link", async () => {
    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("album-icon")).toBeInTheDocument();
  });

  it("should render settings icon for settings link", async () => {
    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("settings-icon")).toBeInTheDocument();
  });

  it("should render storage icon for playlists link", async () => {
    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("storage-icon")).toBeInTheDocument();
  });

  it("should render manage accounts icon for roster link when visible", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.SM,
    });

    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("manage-accounts-icon")).toBeInTheDocument();
  });

  it("should render edit calendar icon for schedule link when visible", async () => {
    const { getUserFromSession } = await import(
      "@/lib/features/authentication/server-utils"
    );
    vi.mocked(getUserFromSession).mockResolvedValue({
      ...mockUser,
      authority: Authorization.SM,
    });

    const Component = await Leftbar();
    render(Component);

    expect(screen.getByTestId("edit-calendar-icon")).toBeInTheDocument();
  });
});
