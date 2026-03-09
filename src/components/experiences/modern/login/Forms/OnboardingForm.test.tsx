import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import OnboardingForm from "./OnboardingForm";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import React from "react";

// Mock authentication hooks
const mockHandleNewUser = vi.fn((e) => e.preventDefault());
const mockAddRequiredCredentials = vi.fn();

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useNewUser: vi.fn(() => ({
    handleNewUser: mockHandleNewUser,
    verified: false,
    authenticating: false,
    addRequiredCredentials: mockAddRequiredCredentials,
  })),
}));

function createTestStore() {
  return configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
    },
  });
}

function createWrapper() {
  const store = createTestStore();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("OnboardingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the form", () => {
    const Wrapper = createWrapper();
    const { container } = render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    expect(container.querySelector("form")).toBeInTheDocument();
  });

  it("should render hidden username input with provided value", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    const hiddenInput = document.querySelector('input[name="username"]');
    expect(hiddenInput).toHaveValue("testuser");
  });

  it("should render real name input", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    expect(screen.getByText("Real Name")).toBeInTheDocument();
  });

  it("should render DJ name input", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    expect(screen.getByText("DJ Name")).toBeInTheDocument();
  });

  it("should render password input with requirements", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    expect(screen.getByText("New Password")).toBeInTheDocument();
    expect(
      screen.getByText(/Must be at least 8 characters/)
    ).toBeInTheDocument();
  });

  it("should render confirm password input", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    expect(screen.getByText("Confirm New Password")).toBeInTheDocument();
  });

  it("should render submit button", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    expect(screen.getByRole("button", { name: /submit|sign up/i })).toBeInTheDocument();
  });

  it("should call addRequiredCredentials on mount", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm username="testuser" />
      </Wrapper>
    );

    expect(mockAddRequiredCredentials).toHaveBeenCalledWith([
      "username",
      "realName",
      "password",
      "confirmPassword",
    ]);
  });

  it("should render with initial realName and djName values", () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <OnboardingForm
          username="testuser"
          realName="John Doe"
          djName="DJ John"
        />
      </Wrapper>
    );

    // Form should render with provided values
    expect(screen.getByText("Real Name")).toBeInTheDocument();
    expect(screen.getByText("DJ Name")).toBeInTheDocument();
  });
});
