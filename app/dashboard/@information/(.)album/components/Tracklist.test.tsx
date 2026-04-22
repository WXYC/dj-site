import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Tracklist from "./Tracklist";

describe("Tracklist", () => {
  it("renders 'No tracklist available' when tracklist is undefined", () => {
    render(<Tracklist tracklist={undefined} />);
    expect(screen.getByText("No tracklist available")).toBeInTheDocument();
  });

  it("renders 'No tracklist available' when tracklist is empty", () => {
    render(<Tracklist tracklist={[]} />);
    expect(screen.getByText("No tracklist available")).toBeInTheDocument();
  });

  it("renders table with tracks when tracklist has entries", () => {
    const tracklist = [
      { position: "1", title: "la paradoja", duration: "4:32" },
      { position: "2", title: "In a Sentimental Mood", duration: "5:27" },
      { position: "3", title: "Call Your Name", duration: "3:15" },
    ];

    render(<Tracklist tracklist={tracklist} />);

    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();

    expect(screen.getByText("la paradoja")).toBeInTheDocument();
    expect(screen.getByText("4:32")).toBeInTheDocument();
    expect(screen.getByText("In a Sentimental Mood")).toBeInTheDocument();
    expect(screen.getByText("5:27")).toBeInTheDocument();
    expect(screen.getByText("Call Your Name")).toBeInTheDocument();
    expect(screen.getByText("3:15")).toBeInTheDocument();
  });

  it("renders correct number of rows", () => {
    const tracklist = [
      { position: "A1", title: "VI Scose Poise", duration: "6:10" },
      { position: "A2", title: "Cfern", duration: "4:45" },
    ];

    render(<Tracklist tracklist={tracklist} />);

    const rows = screen.getAllByRole("row");
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });
});
