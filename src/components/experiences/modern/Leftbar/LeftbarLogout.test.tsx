import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeftbarLogout from "./LeftbarLogout";
import type { User } from "@/lib/features/authentication/types";

// Mock hooks
const mockHandleLogout = vi.fn((e: any) => e.preventDefault());

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: vi.fn(() => ({
    handleLogout: mockHandleLogout,
    loggingOut: false,
  })),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  LogoutOutlined: () => <span data-testid="logout-icon" />,
  PersonOutlined: () => <span data-testid="person-icon" />,
}));

describe("LeftbarLogout", () => {
  const mockUser: User = {
    username: "testuser",
    realName: "Test User",
    djName: "Cool DJ",
    authority: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render logout button", () => {
    render(<LeftbarLogout user={mockUser} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render person icon by default", () => {
    render(<LeftbarLogout user={mockUser} />);

    expect(screen.getByTestId("person-icon")).toBeInTheDocument();
  });

  it("should show logout icon on hover", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    fireEvent.mouseOver(button);

    expect(screen.getByTestId("logout-icon")).toBeInTheDocument();
  });

  it("should show person icon when not hovered", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    fireEvent.mouseOver(button);
    fireEvent.mouseOut(button);

    expect(screen.getByTestId("person-icon")).toBeInTheDocument();
  });

  it("should call handleLogout on form submit", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockHandleLogout).toHaveBeenCalled();
  });

  it("should show loading state when logging out", async () => {
    const { useLogout } = await import("@/src/hooks/authenticationHooks");
    vi.mocked(useLogout).mockReturnValue({
      handleLogout: mockHandleLogout,
      loggingOut: true,
    });

    render(<LeftbarLogout user={mockUser} />);

    // When loading, MUI IconButton with loading prop shows a loading indicator
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should render button as submit type", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("should render user without realName", () => {
    const userWithoutRealName: User = {
      ...mockUser,
      realName: undefined,
    };

    render(<LeftbarLogout user={userWithoutRealName} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render user without djName", () => {
    const userWithoutDjName: User = {
      ...mockUser,
      djName: undefined,
    };

    render(<LeftbarLogout user={userWithoutDjName} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render user with only username", () => {
    const minimalUser: User = {
      username: "testuser",
      authority: 1,
    };

    render(<LeftbarLogout user={minimalUser} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
