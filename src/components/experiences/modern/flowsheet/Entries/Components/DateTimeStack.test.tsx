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

  it("should render day when entry is not today", () => {
    // Use a date far in the past that cannot be today
    render(<DateTimeStack day="2020-01-01" time="10:30 AM" />);

    // Day should be shown since it's definitely not today
    expect(screen.getByText("2020-01-01")).toBeInTheDocument();
  });

  it("should show day when year differs from today", () => {
    // Get a date with a different year
    const today = new Date();
    const diffYear = `${today.getFullYear() - 1}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    render(<DateTimeStack day={diffYear} time="10:30 AM" />);

    // Different year means not today, so day should be shown
    expect(screen.getByText(diffYear)).toBeInTheDocument();
  });

  it("should show day when month differs from today", () => {
    // Get a date with a different month
    const today = new Date();
    const month = today.getMonth() === 0 ? 11 : today.getMonth() - 1; // Previous month
    const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const diffMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    render(<DateTimeStack day={diffMonth} time="10:30 AM" />);

    // Different month means not today, so day should be shown
    expect(screen.getByText(diffMonth)).toBeInTheDocument();
  });

  it("should show day when date differs from today", () => {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const diffDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    render(<DateTimeStack day={diffDate} time="10:30 AM" />);

    // Different date means not today, so day should be shown
    expect(screen.getByText(diffDate)).toBeInTheDocument();
  });
});
