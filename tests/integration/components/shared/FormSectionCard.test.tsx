import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import FormSectionCard from "@/src/components/shared/FormSectionCard";

describe("FormSectionCard", () => {
  it("renders title, description, children, and data-testid", () => {
    renderWithProviders(
      <FormSectionCard
        title="Artist"
        description="Pick a genre first."
        data-testid="test-section-card"
      >
        <span>child field</span>
      </FormSectionCard>
    );

    expect(screen.getByText("Artist")).toBeInTheDocument();
    expect(screen.getByText("Pick a genre first.")).toBeInTheDocument();
    expect(screen.getByText("child field")).toBeInTheDocument();
    expect(screen.getByTestId("test-section-card")).toBeInTheDocument();
    expect(screen.getByTestId("test-section-card").className).toMatch(
      /MuiCard-root/
    );
  });

  it("renders footer when provided", () => {
    renderWithProviders(
      <FormSectionCard title="Album" footer={<button type="button">Save</button>}>
        <span>fields</span>
      </FormSectionCard>
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("dims and blocks pointer events when disabled", () => {
    renderWithProviders(
      <FormSectionCard title="Album" disabled data-testid="disabled-card">
        <span>fields</span>
      </FormSectionCard>
    );

    expect(screen.getByTestId("disabled-card")).toHaveStyle({
      "pointer-events": "none",
    });
  });
});
