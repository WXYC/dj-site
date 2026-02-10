import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act, waitFor } from "@testing-library/react";
import RequiredBox from "./RequiredBox";
import { renderWithProviders } from "@/lib/test-utils";
import { authenticationSlice } from "@/lib/features/authentication/frontend";

describe("RequiredBox", () => {
  it("should render with label", () => {
    renderWithProviders(<RequiredBox name="username" title="Username" />);
    expect(screen.getByText("Username")).toBeInTheDocument();
  });

  it("should render input with placeholder", () => {
    renderWithProviders(
      <RequiredBox name="username" title="Username" placeholder="Enter username" />
    );
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
  });

  it("should use default placeholder when not provided", () => {
    renderWithProviders(<RequiredBox name="username" title="Username" />);
    expect(screen.getByPlaceholderText("Enter your username")).toBeInTheDocument();
  });

  it("should update verification state on input change", async () => {
    const { user, store } = renderWithProviders(
      <RequiredBox name="username" title="Username" />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "testuser");

    const state = store.getState();
    expect(authenticationSlice.selectors.getVerification(state, "username")).toBe(true);
  });

  it("should set verification to false when input is cleared", async () => {
    const { user, store } = renderWithProviders(
      <RequiredBox name="username" title="Username" />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "testuser");
    await user.clear(input);

    const state = store.getState();
    expect(authenticationSlice.selectors.getVerification(state, "username")).toBe(false);
  });

  it("should use custom validation function", async () => {
    const { user, store } = renderWithProviders(
      <RequiredBox
        name="password"
        title="Password"
        type="password"
        validationFunction={(value) => value.length >= 8}
      />
    );

    const input = screen.getByPlaceholderText("Enter your password");

    // Too short - should not validate
    await user.type(input, "short");
    expect(authenticationSlice.selectors.getVerification(store.getState(), "password")).toBe(false);

    // Clear and type valid password
    await user.clear(input);
    await user.type(input, "longenough");
    expect(authenticationSlice.selectors.getVerification(store.getState(), "password")).toBe(true);
  });

  it("should be disabled when disabled prop is true", () => {
    renderWithProviders(
      <RequiredBox name="username" title="Username" disabled={true} />
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("should render helper text", () => {
    renderWithProviders(
      <RequiredBox name="password" title="Password" helper="Must be 8 characters" />
    );
    expect(screen.getByText("Must be 8 characters")).toBeInTheDocument();
  });

  it("should render with password type", () => {
    renderWithProviders(
      <RequiredBox name="password" title="Password" type="password" />
    );
    // Password inputs have their type attribute
    const input = screen.getByPlaceholderText("Enter your password");
    expect(input).toHaveAttribute("type", "password");
  });

  it("should have required attribute on form control", () => {
    renderWithProviders(<RequiredBox name="username" title="Username" />);
    // The input should be required
    const input = screen.getByRole("textbox");
    expect(input).toBeRequired();
  });

  it("should set initial value when provided", () => {
    renderWithProviders(
      <RequiredBox name="username" title="Username" initialValue="testuser" />
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("testuser");
  });

  it("should update value when initialValue prop changes", async () => {
    const { rerender } = renderWithProviders(
      <RequiredBox name="username" title="Username" initialValue="first" />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("first");

    rerender(<RequiredBox name="username" title="Username" initialValue="second" />);

    await waitFor(() => {
      expect(input.value).toBe("second");
    });
  });
});

describe("RequiredBox DOM sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should sync from DOM when DOM value differs from state", async () => {
    const { store } = renderWithProviders(
      <RequiredBox name="username" title="Username" />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Simulate browser autofill by directly setting DOM value
    Object.defineProperty(input, "value", {
      get: () => "autofilled",
      set: () => {},
      configurable: true,
    });

    // Advance timers to trigger the syncFromDom effect
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // The validation should have been triggered
    const state = store.getState();
    expect(
      authenticationSlice.selectors.getVerification(state, "username")
    ).toBe(true);
  });

  it("should sync validation state on mount timeout", async () => {
    const { store } = renderWithProviders(
      <RequiredBox name="username" title="Username" />
    );

    // Initial state should be unverified
    expect(
      authenticationSlice.selectors.getVerification(store.getState(), "username")
    ).toBe(false);

    // Advance timers past the 300ms sync timeout
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Validation should still be false (empty input)
    expect(
      authenticationSlice.selectors.getVerification(store.getState(), "username")
    ).toBe(false);
  });
});
