import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { ValidatedSubmitButton } from "./ValidatedSubmitButton";
import { renderWithProviders } from "@/lib/test-utils";

describe("ValidatedSubmitButton", () => {
  it("should render with Submit text", () => {
    renderWithProviders(
      <ValidatedSubmitButton authenticating={false} valid={true} />
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should be enabled when valid and not authenticating", () => {
    renderWithProviders(
      <ValidatedSubmitButton authenticating={false} valid={true} />
    );
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("should be disabled when not valid", () => {
    renderWithProviders(
      <ValidatedSubmitButton authenticating={false} valid={false} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should be disabled when authenticating", () => {
    renderWithProviders(
      <ValidatedSubmitButton authenticating={true} valid={true} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should be disabled when both invalid and authenticating", () => {
    renderWithProviders(
      <ValidatedSubmitButton authenticating={true} valid={false} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should have type submit", () => {
    renderWithProviders(
      <ValidatedSubmitButton authenticating={false} valid={true} />
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("should accept fullWidth prop", () => {
    renderWithProviders(
      <ValidatedSubmitButton authenticating={false} valid={true} fullWidth />
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
