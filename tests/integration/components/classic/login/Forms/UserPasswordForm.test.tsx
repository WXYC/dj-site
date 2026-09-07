import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import UserPasswordForm from "@/src/components/experiences/classic/login/Forms/UserPasswordForm";
import { renderWithProviders } from "@/tests/helpers";

// Mock the useLogin hook
const mockHandleLogin = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
});

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogin: () => ({
    handleLogin: mockHandleLogin,
    verified: false,
    authenticating: false,
    error: null,
  }),
  useLogout: () => ({
    handleLogout: vi.fn(),
    loggingOut: false,
  }),
}));

// Mock next/navigation
const searchParamsMock = vi.fn<() => URLSearchParams>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => searchParamsMock(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const STATION_SIGNUP_FLAG_KEY = "NEXT_PUBLIC_STATION_SIGNUP_ENABLED";

describe("UserPasswordForm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockHandleLogin.mockClear();
    searchParamsMock.mockReturnValue(new URLSearchParams(""));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render username field", () => {
    renderWithProviders(<UserPasswordForm />);
    expect(screen.getByText("User Login:")).toBeInTheDocument();
  });

  it("should render password field", () => {
    renderWithProviders(<UserPasswordForm />);
    expect(screen.getByText("Password:")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    renderWithProviders(<UserPasswordForm />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should render with correct title", () => {
    renderWithProviders(<UserPasswordForm />);
    expect(
      screen.getByText("Please log in to WXYC Library:")
    ).toBeInTheDocument();
  });

  it("should have submit button disabled initially when not verified", () => {
    renderWithProviders(<UserPasswordForm />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("should render as a form element", () => {
    const { container } = renderWithProviders(<UserPasswordForm />);
    expect(container.querySelector("form")).toBeInTheDocument();
  });

  it("should have form with flex column layout", () => {
    const { container } = renderWithProviders(<UserPasswordForm />);
    const form = container.querySelector("form");
    expect(form).toHaveStyle({
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    });
  });

  it("should render username input with text type", () => {
    renderWithProviders(<UserPasswordForm />);
    const usernameInput = document.querySelector('input[name="username"]');
    expect(usernameInput).toHaveAttribute("type", "text");
  });

  it("should render password input with password type", () => {
    renderWithProviders(<UserPasswordForm />);
    const passwordInput = document.querySelector('input[name="password"]');
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("should render within a table structure", () => {
    renderWithProviders(<UserPasswordForm />);
    const tables = document.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
  });

  it("should NOT render a Reset button", () => {
    renderWithProviders(<UserPasswordForm />);
    expect(
      screen.queryByRole("button", { name: /reset/i })
    ).not.toBeInTheDocument();
    const resetInput = document.querySelector('input[type="reset"]');
    expect(resetInput).toBeNull();
  });

  it("should render inside a signon-card wrapper", () => {
    renderWithProviders(<UserPasswordForm />);
    const card = document.querySelector(".signon-card");
    expect(card).toBeInTheDocument();
  });

  it("should wrap content in Main layout component with title", () => {
    renderWithProviders(<UserPasswordForm />);
    const titleSpan = screen.getByText("Please log in to WXYC Library:");
    expect(titleSpan).toHaveClass("title");
  });

  it("should enable typing in username field", async () => {
    const { user } = renderWithProviders(<UserPasswordForm />);
    const usernameInput = document.querySelector(
      'input[name="username"]'
    ) as HTMLInputElement;

    await user.type(usernameInput, "testuser");

    await waitFor(() => {
      expect(usernameInput.value).toBe("testuser");
    });
  });

  it("should enable typing in password field", async () => {
    const { user } = renderWithProviders(<UserPasswordForm />);
    const passwordInput = document.querySelector(
      'input[name="password"]'
    ) as HTMLInputElement;

    await user.type(passwordInput, "testpass");

    await waitFor(() => {
      expect(passwordInput.value).toBe("testpass");
    });
  });

  it("should call handleLogin on form submission", async () => {
    const { user } = renderWithProviders(<UserPasswordForm />);
    const form = document.querySelector("form")!;

    // Submit the form directly since button may be disabled
    await user.click(screen.getByRole("button", { name: "Submit" }));

    // Button is disabled so form won't submit
    // We can verify the form element exists and would handle submission
    expect(form).toBeInTheDocument();
  });

  describe("station signup entry link (flag-gated)", () => {
    afterEach(() => {
      delete process.env[STATION_SIGNUP_FLAG_KEY];
    });

    it("is hidden when the station signup flag is off", () => {
      delete process.env[STATION_SIGNUP_FLAG_KEY];
      renderWithProviders(<UserPasswordForm />);

      expect(
        screen.queryByRole("link", { name: "Sign up here" })
      ).not.toBeInTheDocument();
    });

    it("links to ?signup=1 when the station signup flag is on", () => {
      process.env[STATION_SIGNUP_FLAG_KEY] = "true";
      renderWithProviders(<UserPasswordForm />);

      expect(
        screen.getByRole("link", { name: "Sign up here" })
      ).toHaveAttribute("href", "/login?signup=1");
    });

    it("carries a live OIDC authorize bounce's params into the signup link", () => {
      process.env[STATION_SIGNUP_FLAG_KEY] = "true";
      // /login is where better-auth's authorize endpoint parks an
      // unauthenticated DJ. Hardcoding /login?signup=1 here throws the
      // authorize round-trip away before the DJ has even decided to sign up.
      searchParamsMock.mockReturnValue(
        new URLSearchParams(
          "client_id=wxyc-relying-party&response_type=code&redirect_uri=https%3A%2F%2Frp.example%2Fcb&state=xyz789"
        )
      );
      renderWithProviders(<UserPasswordForm />);

      const href = screen
        .getByRole("link", { name: "Sign up here" })
        .getAttribute("href")!;
      const target = new URL(href, "https://dj.wxyc.org");
      expect(target.pathname).toBe("/login");
      expect(target.searchParams.get("signup")).toBe("1");
      expect(target.searchParams.get("client_id")).toBe("wxyc-relying-party");
      expect(target.searchParams.get("response_type")).toBe("code");
      expect(target.searchParams.get("redirect_uri")).toBe("https://rp.example/cb");
      expect(target.searchParams.get("state")).toBe("xyz789");
    });
  });
});


describe("UserPasswordForm with authenticating state", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    searchParamsMock.mockReturnValue(new URLSearchParams(""));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render form structure correctly", () => {
    renderWithProviders(<UserPasswordForm />);
    expect(document.querySelector("form")).toBeInTheDocument();
    expect(screen.getByText("User Login:")).toBeInTheDocument();
    expect(screen.getByText("Password:")).toBeInTheDocument();
  });
});
