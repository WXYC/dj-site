import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EntryText from "@/src/widgets/NowPlaying/EntryText";
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
  Typography: ({ children, level, color, textColor, ...props }: any) => (
    <span
      data-testid="typography"
      data-level={level}
      data-color={color}
      data-text-color={textColor}
      {...props}
    >
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
    const songEntry: FlowsheetSongEntry = {
      ...baseEntry,
      track_title: "la paradoja",
      artist_name: "Juana Molina",
      album_title: "DOGA",
      record_label: "Sonamos",
      request_flag: false,
      segue: false,
    };

    it("should display track title, artist name, and album title", () => {
      render(<EntryText entry={songEntry} />);

      expect(screen.getByText("la paradoja")).toBeInTheDocument();
      expect(screen.getByText("Juana Molina")).toBeInTheDocument();
      expect(screen.getByText("DOGA")).toBeInTheDocument();
    });

    it("should render the track title as the headline, above artist and album", () => {
      render(<EntryText entry={songEntry} />);

      expect(screen.getByText("la paradoja")).toHaveAttribute("data-level", "title-md");
      expect(screen.getByText("Juana Molina")).toHaveAttribute("data-level", "body-sm");
      expect(screen.getByText("DOGA")).toHaveAttribute("data-level", "body-sm");
    });

    it("should render the album title with tertiary text color", () => {
      render(<EntryText entry={songEntry} />);

      expect(screen.getByText("DOGA")).toHaveAttribute("data-text-color", "text.tertiary");
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
