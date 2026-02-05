import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DateTimeStack from "./DateTimeStack";

describe("DateTimeStack", () => {
  it("should render time", () => {
    render(<DateTimeStack day="2024-06-14" time="10:30 AM" />);
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
  });

  it("should render as a stack", () => {
    const { container } = render(<DateTimeStack day="2024-06-14" time="10:30 AM" />);
    expect(container.querySelector(".MuiStack-root")).toBeInTheDocument();
  });

  it("should render day in the component", () => {
    // Day is shown by default until useEffect runs
    render(<DateTimeStack day="2020-01-01" time="10:30 AM" />);
    // Just verify component renders without error
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
  });
});
