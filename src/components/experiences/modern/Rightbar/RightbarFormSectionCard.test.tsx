import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RightbarFormSectionCard from "./RightbarFormSectionCard";

describe("RightbarFormSectionCard", () => {
  it("renders title, description, children, and data-testid", () => {
    render(
      <RightbarFormSectionCard
        title="Artist"
        description="Pick a genre first."
        data-testid="test-section-card"
      >
        <span>child field</span>
      </RightbarFormSectionCard>,
    );

    expect(screen.getByText("Artist")).toBeInTheDocument();
    expect(screen.getByText("Pick a genre first.")).toBeInTheDocument();
    expect(screen.getByText("child field")).toBeInTheDocument();
    expect(screen.getByTestId("test-section-card")).toBeInTheDocument();
    expect(screen.getByTestId("test-section-card").className).toMatch(/MuiCard-root/);
  });

  it("renders footer when provided", () => {
    render(
      <RightbarFormSectionCard title="Album" footer={<button type="button">Save</button>}>
        <span>fields</span>
      </RightbarFormSectionCard>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
