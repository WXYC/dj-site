import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Entry from "./Entry";
import {
  FlowsheetSongEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
  FlowsheetBreakpointEntry,
} from "@/lib/features/flowsheet/types";

// Mock child components
vi.mock("./SongEntry/SongEntry", () => ({
  default: ({ entry, playing, queue }: any) => (
    <tr data-testid="song-entry" data-playing={playing} data-queue={queue}>
      {entry.track_title}
    </tr>
  ),
}));

vi.mock("./MessageEntry", () => ({
  default: ({
    children,
    startDecorator,
    endDecorator,
    color,
    variant,
    entryRef,
    disableEditing,
  }: any) => (
    <tr
      data-testid="message-entry"
      data-color={color}
      data-variant={variant}
      data-disable-editing={disableEditing}
    >
      <td data-testid="start-decorator">{startDecorator}</td>
      <td data-testid="children">{children}</td>
      <td data-testid="end-decorator">{endDecorator}</td>
    </tr>
  ),
}));

vi.mock("./Components/DateTimeStack", () => ({
  default: ({ day, time }: any) => (
    <span data-testid="datetime-stack">
      {day} {time}
    </span>
  ),
}));

describe("Entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Song Entry", () => {
    const mockSongEntry: FlowsheetSongEntry = {
      id: 1,
      play_order: 0,
      show_id: 100,
      track_title: "Test Track",
      artist_name: "Test Artist",
      album_title: "Test Album",
      record_label: "Test Label",
      request_flag: false,
    };

    it("should render SongEntry for song entries", () => {
      render(<Entry entry={mockSongEntry} playing={false} />);

      expect(screen.getByTestId("song-entry")).toBeInTheDocument();
      expect(screen.getByText("Test Track")).toBeInTheDocument();
    });

    it("should pass playing prop to SongEntry", () => {
      render(<Entry entry={mockSongEntry} playing={true} />);

      expect(screen.getByTestId("song-entry")).toHaveAttribute(
        "data-playing",
        "true"
      );
    });

    it("should pass queue=false to SongEntry", () => {
      render(<Entry entry={mockSongEntry} playing={false} />);

      expect(screen.getByTestId("song-entry")).toHaveAttribute(
        "data-queue",
        "false"
      );
    });
  });

  describe("Start Show Entry", () => {
    const mockStartShowEntry: FlowsheetShowBlockEntry = {
      id: 2,
      play_order: 0,
      show_id: 100,
      dj_name: "DJ TestName",
      day: "Monday",
      time: "10:00 PM",
      isStart: true,
    };

    it("should render MessageEntry for start show entries", () => {
      render(<Entry entry={mockStartShowEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toBeInTheDocument();
    });

    it("should display DJ name in start show entry", () => {
      render(<Entry entry={mockStartShowEntry} playing={false} />);

      expect(screen.getByText("DJ TestName")).toBeInTheDocument();
    });

    it("should display 'started the set' text", () => {
      render(<Entry entry={mockStartShowEntry} playing={false} />);

      expect(screen.getByText("started the set")).toBeInTheDocument();
    });

    it("should render DateTimeStack with day and time", () => {
      render(<Entry entry={mockStartShowEntry} playing={false} />);

      expect(screen.getByTestId("datetime-stack")).toBeInTheDocument();
      expect(screen.getByText("Monday 10:00 PM")).toBeInTheDocument();
    });

    it("should have disableEditing=true for start show entry", () => {
      render(<Entry entry={mockStartShowEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-disable-editing",
        "true"
      );
    });

    it("should have neutral color and soft variant", () => {
      render(<Entry entry={mockStartShowEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-color",
        "neutral"
      );
      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-variant",
        "soft"
      );
    });

    it("should render Headphones icon as start decorator", () => {
      render(<Entry entry={mockStartShowEntry} playing={false} />);

      const startDecorator = screen.getByTestId("start-decorator");
      expect(startDecorator.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("End Show Entry", () => {
    const mockEndShowEntry: FlowsheetShowBlockEntry = {
      id: 3,
      play_order: 10,
      show_id: 100,
      dj_name: "DJ EndTest",
      day: "Tuesday",
      time: "2:00 AM",
      isStart: false,
    };

    it("should render MessageEntry for end show entries", () => {
      render(<Entry entry={mockEndShowEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toBeInTheDocument();
    });

    it("should display DJ name in end show entry", () => {
      render(<Entry entry={mockEndShowEntry} playing={false} />);

      expect(screen.getByText("DJ EndTest")).toBeInTheDocument();
    });

    it("should display 'ended the set' text", () => {
      render(<Entry entry={mockEndShowEntry} playing={false} />);

      expect(screen.getByText("ended the set")).toBeInTheDocument();
    });

    it("should render DateTimeStack with day and time", () => {
      render(<Entry entry={mockEndShowEntry} playing={false} />);

      expect(screen.getByTestId("datetime-stack")).toBeInTheDocument();
      expect(screen.getByText("Tuesday 2:00 AM")).toBeInTheDocument();
    });

    it("should have disableEditing=true for end show entry", () => {
      render(<Entry entry={mockEndShowEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-disable-editing",
        "true"
      );
    });

    it("should render Logout icon as start decorator", () => {
      render(<Entry entry={mockEndShowEntry} playing={false} />);

      const startDecorator = screen.getByTestId("start-decorator");
      expect(startDecorator.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Talkset Entry", () => {
    const mockTalksetEntry: FlowsheetMessageEntry = {
      id: 4,
      play_order: 5,
      show_id: 100,
      message: "Talkset - Station ID",
    };

    it("should render MessageEntry for talkset entries", () => {
      render(<Entry entry={mockTalksetEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toBeInTheDocument();
    });

    it("should display talkset message", () => {
      render(<Entry entry={mockTalksetEntry} playing={false} />);

      expect(screen.getByText("Talkset - Station ID")).toBeInTheDocument();
    });

    it("should have neutral color and soft variant", () => {
      render(<Entry entry={mockTalksetEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-color",
        "neutral"
      );
      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-variant",
        "soft"
      );
    });

    it("should render Mic icon as start decorator", () => {
      render(<Entry entry={mockTalksetEntry} playing={false} />);

      const startDecorator = screen.getByTestId("start-decorator");
      expect(startDecorator.querySelector("svg")).toBeInTheDocument();
    });

    it("should not have disableEditing set (defaults to false)", () => {
      render(<Entry entry={mockTalksetEntry} playing={false} />);

      // Since disableEditing is not passed, it defaults to false
      expect(
        screen.getByTestId("message-entry").getAttribute("data-disable-editing")
      ).not.toBe("true");
    });
  });

  describe("Breakpoint Entry", () => {
    const mockBreakpointEntry: FlowsheetBreakpointEntry = {
      id: 5,
      play_order: 7,
      show_id: 100,
      message: "Breakpoint - Hour Mark",
      day: "Wednesday",
      time: "11:00 PM",
    };

    it("should render MessageEntry for breakpoint entries", () => {
      render(<Entry entry={mockBreakpointEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toBeInTheDocument();
    });

    it("should display breakpoint message", () => {
      render(<Entry entry={mockBreakpointEntry} playing={false} />);

      expect(screen.getByText("Breakpoint - Hour Mark")).toBeInTheDocument();
    });

    it("should have neutral color and soft variant", () => {
      render(<Entry entry={mockBreakpointEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-color",
        "neutral"
      );
      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-variant",
        "soft"
      );
    });

    it("should render Timer icon as start decorator", () => {
      render(<Entry entry={mockBreakpointEntry} playing={false} />);

      const startDecorator = screen.getByTestId("start-decorator");
      expect(startDecorator.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Generic Message Entry (fallback)", () => {
    const mockGenericMessageEntry: FlowsheetMessageEntry = {
      id: 6,
      play_order: 8,
      show_id: 100,
      message: "Generic notification message",
    };

    it("should render MessageEntry for generic message entries", () => {
      render(<Entry entry={mockGenericMessageEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toBeInTheDocument();
    });

    it("should display generic message", () => {
      render(<Entry entry={mockGenericMessageEntry} playing={false} />);

      expect(screen.getByText("Generic notification message")).toBeInTheDocument();
    });

    it("should have neutral color and soft variant", () => {
      render(<Entry entry={mockGenericMessageEntry} playing={false} />);

      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-color",
        "neutral"
      );
      expect(screen.getByTestId("message-entry")).toHaveAttribute(
        "data-variant",
        "soft"
      );
    });

    it("should render Notifications icon as start decorator", () => {
      render(<Entry entry={mockGenericMessageEntry} playing={false} />);

      const startDecorator = screen.getByTestId("start-decorator");
      expect(startDecorator.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Playing state", () => {
    const mockSongEntry: FlowsheetSongEntry = {
      id: 1,
      play_order: 0,
      show_id: 100,
      track_title: "Test Track",
      artist_name: "Test Artist",
      album_title: "Test Album",
      record_label: "Test Label",
      request_flag: false,
    };

    it("should pass playing=true to SongEntry when playing", () => {
      render(<Entry entry={mockSongEntry} playing={true} />);

      expect(screen.getByTestId("song-entry")).toHaveAttribute(
        "data-playing",
        "true"
      );
    });

    it("should pass playing=false to SongEntry when not playing", () => {
      render(<Entry entry={mockSongEntry} playing={false} />);

      expect(screen.getByTestId("song-entry")).toHaveAttribute(
        "data-playing",
        "false"
      );
    });
  });
});
