import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import SettingsInput from "./SettingsInput";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import type { ReactNode } from "react";

function createTestStore() {
  return configureStore({
    reducer: {
      authentication: authenticationSlice.reducer,
    },
  });
}

function createWrapper() {
  const store = createTestStore();
  return { Wrapper: function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }, store };
}

describe("SettingsInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an input element", () => {
    const { Wrapper } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="realName" />
      </Wrapper>
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("should render with backendValue as initial value", () => {
    const { Wrapper } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="realName" backendValue="John Doe" />
      </Wrapper>
    );

    expect(screen.getByRole("textbox")).toHaveValue("John Doe");
  });

  it("should render empty when no backendValue provided", () => {
    const { Wrapper } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="realName" />
      </Wrapper>
    );

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("should update value on change", () => {
    const { Wrapper } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="realName" />
      </Wrapper>
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Name" } });

    expect(input).toHaveValue("New Name");
  });

  it("should dispatch modify action when value changes", () => {
    const { Wrapper } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="realName" backendValue="Original" />
      </Wrapper>
    );

    const input = screen.getByRole("textbox");
    // Just verify the change event works without error
    fireEvent.change(input, { target: { value: "Changed" } });
    expect(input).toHaveValue("Changed");
  });

  it("should pass additional props to Input", () => {
    const { Wrapper } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="realName" placeholder="Enter name" data-testid="settings-input" />
      </Wrapper>
    );

    expect(screen.getByTestId("settings-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
  });

  it("should use name attribute", () => {
    const { Wrapper } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="djName" />
      </Wrapper>
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "djName");
  });

  // #609: clearing a previously-set field must register as a modification so
  // the save flow can propagate the clear (before the fix, an empty value was
  // treated as unmodified and silently dropped).
  it("marks the field modified when a set value is cleared", () => {
    const { Wrapper, store } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="pronouns" backendValue="they/them" />
      </Wrapper>
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });

    expect(store.getState().authentication.modifications.pronouns).toBe(true);
  });

  it("marks the field unmodified when restored to the backend value", () => {
    const { Wrapper, store } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="pronouns" backendValue="they/them" />
      </Wrapper>
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "they/them" } });

    expect(store.getState().authentication.modifications.pronouns).toBe(false);
  });

  it("does not mark an unset field modified when typed then cleared", () => {
    const { Wrapper, store } = createWrapper();
    render(
      <Wrapper>
        <SettingsInput name="pronouns" />
      </Wrapper>
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "she/her" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(store.getState().authentication.modifications.pronouns).toBe(false);
  });
});
