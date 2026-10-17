import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import HeadedSection from "@/src/components/experiences/modern/reviews/HeadedSection";

describe("HeadedSection", () => {
  it("is a region named by its title, and the title is a level 3 heading by default", () => {
    renderWithProviders(<HeadedSection title="Other reviews">Stereolab</HeadedSection>);
    const region = screen.getByRole("region", { name: "Other reviews" });
    expect(within(region).getByRole("heading", { level: 3, name: "Other reviews" })).toBeInTheDocument();
    expect(within(region).getByText("Stereolab")).toBeInTheDocument();
  });

  it.each([3, 4] as const)("makes the title a level %i heading when passed", (level) => {
    renderWithProviders(<HeadedSection title="Slip" level={level}>Juana Molina</HeadedSection>);
    expect(within(screen.getByRole("region", { name: "Slip" })).getByRole("heading", { level, name: "Slip" })).toBeInTheDocument();
  });

  it("names each of two sections by its own title", () => {
    renderWithProviders(
      <>
        <HeadedSection title="Cover">a</HeadedSection>
        <HeadedSection title="Others">b</HeadedSection>
      </>,
    );
    expect(within(screen.getByRole("region", { name: "Cover" })).queryByText("b")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Others" })).getByText("b")).toBeInTheDocument();
  });

  it("gives a control inside it the title's id, so the same heading names both", () => {
    renderWithProviders(
      <HeadedSection title="File it" titleId="file-it-title">
        <div role="radiogroup" aria-labelledby="file-it-title" />
      </HeadedSection>,
    );
    expect(screen.getByRole("heading", { name: "File it" })).toHaveAttribute("id", "file-it-title");
    expect(screen.getByRole("radiogroup", { name: "File it" })).toBeInTheDocument();
  });

  it("keeps a hidden title as the region's name but takes it off the screen", () => {
    renderWithProviders(<HeadedSection title="Cite a release" hideTitle>search</HeadedSection>);
    const heading = screen.getByRole("heading", { name: "Cite a release" });
    expect(screen.getByRole("region", { name: "Cite a release" })).toBeInTheDocument();
    expect(heading).toHaveStyle({ position: "absolute", width: "1px", height: "1px" });
  });

  it("leaves a shown title in the flow", () => {
    renderWithProviders(<HeadedSection title="Cite a release">search</HeadedSection>);
    expect(screen.getByRole("heading", { name: "Cite a release" })).not.toHaveStyle({ position: "absolute" });
  });
});
