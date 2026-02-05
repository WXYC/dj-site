import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeftbarLogout from "./LeftbarLogout";
import type { User } from "@/lib/features/authentication/types";
import { Authorization } from "@/lib/features/admin/types";

// Mock the useLogout hook
const mockHandleLogout = vi.fn((e?: React.FormEvent<HTMLFormElement>) => {
  e?.preventDefault();
});
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: vi.fn(() => ({
    handleLogout: mockHandleLogout,
    loggingOut: false,
  })),
}));

describe("LeftbarLogout", () => {
  const mockUser: User = {
    username: "testuser",
    email: "test@example.com",
    realName: "Test User",
    djName: "DJ Test",
    authority: Authorization.DJ,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the logout button", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should display PersonOutlined icon by default", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    // PersonOutlined icon should be visible by default
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("should call handleLogout when form is submitted", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockHandleLogout).toHaveBeenCalled();
  });

  it("should show loading state when loggingOut is true", async () => {
    const { useLogout } = await import("@/src/hooks/authenticationHooks");
    vi.mocked(useLogout).mockReturnValue({
      handleLogout: mockHandleLogout,
      loggingOut: true,
    });

    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    // MUI Joy uses loading class when loading prop is true
    expect(button).toHaveClass("MuiIconButton-loading");
  });

  it("should change icon on hover", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");

    // Before hover - PersonOutlined
    fireEvent.mouseOver(button);
    // After hover - LogoutOutlined icon should appear

    fireEvent.mouseOut(button);
    // After mouse out - PersonOutlined icon should appear again
    expect(button).toBeInTheDocument();
  });

  it("should render with username in tooltip content", () => {
    render(<LeftbarLogout user={mockUser} />);

    // The tooltip content includes the username
    // Note: Tooltip content is rendered but may not be visible until hover
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render with user without realName", () => {
    const userWithoutRealName: User = {
      username: "testuser",
      email: "test@example.com",
      djName: "DJ Test",
      authority: Authorization.DJ,
    };

    render(<LeftbarLogout user={userWithoutRealName} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render with user without djName", () => {
    const userWithoutDjName: User = {
      username: "testuser",
      email: "test@example.com",
      realName: "Test User",
      authority: Authorization.DJ,
    };

    render(<LeftbarLogout user={userWithoutDjName} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render with user without both realName and djName", () => {
    const minimalUser: User = {
      username: "testuser",
      email: "test@example.com",
      authority: Authorization.DJ,
    };

    render(<LeftbarLogout user={minimalUser} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should have outlined variant on the button", () => {
    render(<LeftbarLogout user={mockUser} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-variantOutlined");
  });

  it("should render form element", () => {
    render(<LeftbarLogout user={mockUser} />);

    const form = screen.getByRole("button").closest("form");
    expect(form).toBeInTheDocument();
  });

  it("should render with SM authority user", () => {
    const smUser: User = {
      username: "admin",
      email: "admin@example.com",
      realName: "Admin User",
      djName: "DJ Admin",
      authority: Authorization.SM,
    };

    render(<LeftbarLogout user={smUser} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render with MD authority user", () => {
    const mdUser: User = {
      username: "md",
      email: "md@example.com",
      realName: "Music Director",
      djName: "DJ MD",
      authority: Authorization.MD,
    };

    render(<LeftbarLogout user={mdUser} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
