import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ModernLoginShell from "./ModernLoginShell";

const mockReplace = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsGet(key),
  }),
}));

vi.mock("./LoginSlotSwitcher", () => ({
  default: () => <div>Login slots</div>,
}));

describe("ModernLoginShell", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("redirects a complete signed-in user away from /login", async () => {
    render(
      <ModernLoginShell
        redirectCompleteToDashboard
        isIncomplete={false}
        normal={null}
        newuser={null}
        reset={null}
      />
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard/catalog");
    });
    expect(screen.queryByText("Login slots")).not.toBeInTheDocument();
  });

  it("stays on /login when a password-reset token is present", async () => {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "token" ? "reset-token-abc" : null
    );

    render(
      <ModernLoginShell
        redirectCompleteToDashboard
        isIncomplete={false}
        normal={null}
        newuser={null}
        reset={null}
      />
    );

    expect(await screen.findByText("Login slots")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
