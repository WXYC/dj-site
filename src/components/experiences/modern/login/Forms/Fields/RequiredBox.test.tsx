import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
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
});
