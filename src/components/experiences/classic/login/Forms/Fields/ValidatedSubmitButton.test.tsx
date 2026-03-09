import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValidatedSubmitButton } from "./ValidatedSubmitButton";

describe("ValidatedSubmitButton", () => {
  it("should render with Submit text when not authenticating", () => {
    render(<ValidatedSubmitButton authenticating={false} valid={true} />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("should render with Loading text when authenticating", () => {
    render(<ValidatedSubmitButton authenticating={true} valid={true} />);
    expect(screen.getByRole("button", { name: "Loading" })).toBeInTheDocument();
  });

  it("should be enabled when valid and not authenticating", () => {
    render(<ValidatedSubmitButton authenticating={false} valid={true} />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("should be disabled when not valid", () => {
    render(<ValidatedSubmitButton authenticating={false} valid={false} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should be disabled when authenticating", () => {
    render(<ValidatedSubmitButton authenticating={true} valid={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should be disabled when both invalid and authenticating", () => {
    render(<ValidatedSubmitButton authenticating={true} valid={false} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should have type submit", () => {
    render(<ValidatedSubmitButton authenticating={false} valid={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("should have width style of 180px", () => {
    render(<ValidatedSubmitButton authenticating={false} valid={true} />);
    const button = screen.getByRole("button");
    expect(button).toHaveStyle({ width: "180px" });
  });
});
