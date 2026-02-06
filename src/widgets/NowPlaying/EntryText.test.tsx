import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EntryText from "./EntryText";
import type {
  FlowsheetSongEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";

// Mock MUI Joy components
vi.mock("@mui/joy", () => ({
  Stack: ({ children, ...props }: any) => (
    <div data-testid="stack" {...props}>
      {children}
    </div>
  ),
  Typography: ({ children, level, color, ...props }: any) => (
    <span data-testid="typography" data-level={level} data-color={color} {...props}>
      {children}
    </span>
  ),
}));

describe("EntryText", () => {
  const baseEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
  };

  describe("when entry is undefined", () => {
    it("should display default WXYC message", () => {
      render(<EntryText entry={undefined} />);

      expect(screen.getByText("You're Listening To")).toBeInTheDocument();
      expect(screen.getByText("WXYC Chapel Hill")).toBeInTheDocument();
    });
  });

  describe("when entry is a song entry", () => {
    it("should display album title and artist name", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      render(<EntryText entry={songEntry} />);

      expect(screen.getByText("Test Album")).toBeInTheDocument();
      expect(screen.getByText("Test Artist")).toBeInTheDocument();
    });
  });

  describe("when entry is a breakpoint entry", () => {
    it("should display breakpoint message with warning color", () => {
      const breakpointEntry: FlowsheetBreakpointEntry = {
        ...baseEntry,
        message: "Breakpoint: Station ID",
        day: "Monday",
        time: "10:00",
      };

      render(<EntryText entry={breakpointEntry} />);

      expect(screen.getByText("Breakpoint: Station ID")).toBeInTheDocument();
    });
  });

  describe("when entry is a start show entry", () => {
    it("should display DJ name and 'started the set' message", () => {
      const startShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: true,
        day: "Monday",
        time: "10:00",
      };

      render(<EntryText entry={startShowEntry} />);

      expect(screen.getByText("DJ Cool")).toBeInTheDocument();
      expect(screen.getByText("started the set")).toBeInTheDocument();
    });
  });

  describe("when entry is an end show entry", () => {
    it("should display DJ name and 'ended the set' message", () => {
      const endShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: false,
        day: "Monday",
        time: "22:00",
      };

      render(<EntryText entry={endShowEntry} />);

      expect(screen.getByText("DJ Cool")).toBeInTheDocument();
      expect(screen.getByText("ended the set")).toBeInTheDocument();
    });
  });

  describe("when entry is a talkset entry", () => {
    it("should display 'Talkset' with danger color", () => {
      const talksetEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "Talkset",
      };

      render(<EntryText entry={talksetEntry} />);

      expect(screen.getByText("Talkset")).toBeInTheDocument();
    });
  });

  describe("when entry is a generic message entry", () => {
    it("should display the message", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      render(<EntryText entry={messageEntry} />);

      expect(screen.getByText("PSA: Community announcement")).toBeInTheDocument();
    });
  });
});
