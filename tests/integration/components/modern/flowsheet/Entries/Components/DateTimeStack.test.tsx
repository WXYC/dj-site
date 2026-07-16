import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DateTimeStack from "@/src/components/experiences/modern/flowsheet/Entries/Components/DateTimeStack";

describe("DateTimeStack", () => {
  it("should render time", () => {
    render(<DateTimeStack day="6/14/2024" time="10:30 AM" />);
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
  });

  it("should render as a stack", () => {
    const { container } = render(
      <DateTimeStack day="6/14/2024" time="10:30 AM" />
    );
    expect(container.querySelector(".MuiStack-root")).toBeInTheDocument();
  });

  it("should render the date row for an entry that is not from today", () => {
    render(<DateTimeStack day="1/1/2020" time="10:30 AM" isToday={false} />);
    expect(screen.getByText("1/1/2020")).toBeInTheDocument();
  });

  it("should hide the date row for a today entry (isToday true)", () => {
    // No `new Date(day)` reparse happens here — isToday is passed in, so a
    // Safari-style "M/D/YYYY" parse failure can't force the label back on.
    render(<DateTimeStack day="1/1/2020" time="10:30 AM" isToday={true} />);
    expect(screen.queryByText("1/1/2020")).not.toBeInTheDocument();
    expect(screen.getByText("10:30 AM")).toBeInTheDocument();
  });

  it("should show the date row when isToday is omitted (safe default)", () => {
    render(<DateTimeStack day="1/1/2020" time="10:30 AM" />);
    expect(screen.getByText("1/1/2020")).toBeInTheDocument();
  });
});
