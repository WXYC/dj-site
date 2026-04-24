import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import LoginFormSwitcher from "./LoginFormSwitcher";
import { renderWithProviders, createTestStore } from "@/lib/test-utils";
import { applicationSlice } from "@/lib/features/application/frontend";
import type { AuthStage } from "@/lib/features/application/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/features/application/login-method-storage", () => ({
  getPreferredLoginMethod: () => mockPreferredMethod,
  savePreferredLoginMethod: vi.fn(),
}));

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

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });
});
