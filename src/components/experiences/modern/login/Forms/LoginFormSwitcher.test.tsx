import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import LoginFormSwitcher from "./LoginFormSwitcher";
import { renderWithProviders, createTestStore } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import type { AuthStage } from "@/lib/features/application/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/features/application/login-method-storage", () => ({
  getPreferredLoginMethod: () => mockPreferredMethod,
  savePreferredLoginMethod: vi.fn(),
}));

// Stub only the device-auth hook (which would otherwise fetch a device code on
// mount); the other stages keep the real useLogin/useOTPRequest hooks.
vi.mock("@/src/hooks/authenticationHooks", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/src/hooks/authenticationHooks")
  >();
  return {
    ...actual,
    useDeviceAuthorization: () => ({
      status: "waiting" as const,
      userCode: "WDPL-XK9R",
      verificationUriComplete: "https://dj.wxyc.org/device?user_code=WDPL-XK9R",
      restart: vi.fn(),
    }),
  };
});

let mockPreferredMethod: AuthStage = "otp-email";

const renderWithAuthStage = (stage: AuthStage) => {
  mockPreferredMethod = stage;
  const store = createTestStore();
  store.dispatch(applicationSlice.actions.setAuthStage(stage));
  return renderWithProviders(<LoginFormSwitcher />, { store });
};

describe("LoginFormSwitcher", () => {
  it("should render email OTP form by default", () => {
    mockPreferredMethod = "otp-email";
    renderWithProviders(<LoginFormSwitcher />);

    expect(screen.getByRole("button", { name: "Send login code" })).toBeInTheDocument();
  });

  it("should render email OTP form for otp-email stage", () => {
    renderWithAuthStage("otp-email");

    expect(screen.getByRole("button", { name: "Send login code" })).toBeInTheDocument();
  });

  it("should render OTP code form for otp-verify stage", () => {
    renderWithAuthStage("otp-verify");

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("should render password form for password stage", () => {
    renderWithAuthStage("password");

    expect(screen.getByText("Username or email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("should render the QR form for qr stage", () => {
    renderWithAuthStage("qr");

    expect(screen.getByText("Scan to sign in")).toBeInTheDocument();
  });
});
