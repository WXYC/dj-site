import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applicationSlice } from "@/lib/features/application/frontend";
import { renderWithProviders } from "@/tests/helpers";
import LoginSlotSwitcher from "@/app/login/@modern/LoginSlotSwitcher";

const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsGet(key),
  }),
}));

function renderSwitcher(isIncomplete: boolean, token: string | null) {
  mockSearchParamsGet.mockImplementation((key: string) =>
    key === "token" ? token : null
  );

  const store = configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
  });

  return render(
    <Provider store={store}>
      <LoginSlotSwitcher
        isIncomplete={isIncomplete}
        normal={<div>Normal login</div>}
        newuser={<div>Incomplete onboarding</div>}
        reset={<div>Password reset</div>}
      />
    </Provider>
  );
}

describe("LoginSlotSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the reset slot when ?token= is present, even if isIncomplete is true", () => {
    renderSwitcher(true, "reset-token-abc");

    expect(screen.getByText("Password reset")).toBeInTheDocument();
    expect(screen.queryByText("Incomplete onboarding")).not.toBeInTheDocument();
  });

  it("shows the incomplete onboarding slot when there is no reset token", () => {
    renderSwitcher(true, null);

    expect(screen.getByText("Incomplete onboarding")).toBeInTheDocument();
  });
});

describe("LoginSlotSwitcher error-code routing (#617)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithError(errorCode: string | null) {
    mockSearchParamsGet.mockImplementation((key: string) =>
      key === "error" ? errorCode : null
    );

    return renderWithProviders(
      <LoginSlotSwitcher
        isIncomplete={false}
        normal={<div>Normal login</div>}
        newuser={<div>Incomplete onboarding</div>}
        reset={<div>Password reset</div>}
      />
    );
  }

  it("routes the reset-flow error code (INVALID_TOKEN) to the reset slot", () => {
    renderWithError("INVALID_TOKEN");

    expect(screen.getByText("Password reset")).toBeInTheDocument();
    expect(screen.queryByText("Normal login")).not.toBeInTheDocument();
  });

  // Codes emitted by app/auth/verify-email/route.ts — none is a reset error and
  // each must land on the normal login form, never the password-reset slot.
  it("keeps ?error=missing-verification-token on the normal login form with a visible error", () => {
    renderWithError("missing-verification-token");

    expect(screen.getByText("Normal login")).toBeInTheDocument();
    expect(screen.queryByText("Password reset")).not.toBeInTheDocument();
    expect(
      screen.getByText(/something went wrong with that link/i)
    ).toBeInTheDocument();
  });

  it("keeps ?error=verification-failed on the normal login form with its specific alert", () => {
    renderWithError("verification-failed");

    expect(screen.getByText("Normal login")).toBeInTheDocument();
    expect(screen.queryByText("Password reset")).not.toBeInTheDocument();
    expect(screen.getByText(/email verification failed/i)).toBeInTheDocument();
  });

  it("routes an unknown error code to the normal login form with a generic error", () => {
    renderWithError("some-unexpected-code");

    expect(screen.getByText("Normal login")).toBeInTheDocument();
    expect(screen.queryByText("Password reset")).not.toBeInTheDocument();
    expect(
      screen.getByText(/something went wrong with that link/i)
    ).toBeInTheDocument();
  });
});
