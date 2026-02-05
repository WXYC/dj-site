import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExperienceSwitch from "./ExperienceSwitch";

describe("ExperienceSwitch", () => {
  it("should render classic experience when experience is 'classic'", () => {
    render(
      <ExperienceSwitch
        experience="classic"
        classic={<div data-testid="classic-content">Classic Content</div>}
        modern={<div data-testid="modern-content">Modern Content</div>}
      />
    );

    expect(screen.getByTestId("classic-content")).toBeInTheDocument();
    expect(screen.queryByTestId("modern-content")).not.toBeInTheDocument();
    expect(document.getElementById("classic-container")).toBeInTheDocument();
  });

  it("should render modern experience when experience is 'modern'", () => {
    render(
      <ExperienceSwitch
        experience="modern"
        classic={<div data-testid="classic-content">Classic Content</div>}
        modern={<div data-testid="modern-content">Modern Content</div>}
      />
    );

    expect(screen.getByTestId("modern-content")).toBeInTheDocument();
    expect(screen.queryByTestId("classic-content")).not.toBeInTheDocument();
    expect(document.getElementById("modern-container")).toBeInTheDocument();
  });

  it("should render fallback when experience is unknown and fallback is provided", () => {
    render(
      <ExperienceSwitch
        experience={"unknown" as any}
        classic={<div data-testid="classic-content">Classic Content</div>}
        modern={<div data-testid="modern-content">Modern Content</div>}
        fallback={<div data-testid="fallback-content">Fallback Content</div>}
      />
    );

    expect(screen.getByTestId("fallback-content")).toBeInTheDocument();
    expect(screen.queryByTestId("classic-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("modern-content")).not.toBeInTheDocument();
    expect(document.getElementById("modern-container")).toBeInTheDocument();
  });

  it("should render modern experience when experience is unknown and no fallback", () => {
    render(
      <ExperienceSwitch
        experience={"unknown" as any}
        classic={<div data-testid="classic-content">Classic Content</div>}
        modern={<div data-testid="modern-content">Modern Content</div>}
      />
    );

    expect(screen.getByTestId("modern-content")).toBeInTheDocument();
    expect(screen.queryByTestId("classic-content")).not.toBeInTheDocument();
    expect(document.getElementById("modern-container")).toBeInTheDocument();
  });

  it("should wrap classic content in #classic-container div", () => {
    render(
      <ExperienceSwitch
        experience="classic"
        classic={<span>Classic</span>}
        modern={<span>Modern</span>}
      />
    );

    const container = document.getElementById("classic-container");
    expect(container).toBeInTheDocument();
    expect(container?.textContent).toBe("Classic");
  });

  it("should wrap modern content in #modern-container div", () => {
    render(
      <ExperienceSwitch
        experience="modern"
        classic={<span>Classic</span>}
        modern={<span>Modern</span>}
      />
    );

    const container = document.getElementById("modern-container");
    expect(container).toBeInTheDocument();
    expect(container?.textContent).toBe("Modern");
  });
});
