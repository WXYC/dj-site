import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Entry from "./Entry";
import type {
  FlowsheetSongEntry,
  FlowsheetStartShowEntry,
  FlowsheetEndShowEntry,
  FlowsheetTalksetEntry,
  FlowsheetBreakpointEntry,
  FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";

// Mock type guard functions
vi.mock("@/lib/features/flowsheet/types", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    isFlowsheetSongEntry: (entry: any) => entry.entry_type === "song",
    isFlowsheetStartShowEntry: (entry: any) => entry.entry_type === "start_show",
    isFlowsheetEndShowEntry: (entry: any) => entry.entry_type === "end_show",
    isFlowsheetTalksetEntry: (entry: any) => entry.entry_type === "talkset",
    isFlowsheetBreakpointEntry: (entry: any) => entry.entry_type === "breakpoint",
  };
});

// Mock child components
vi.mock("./SongEntry/SongEntry", () => ({
  default: ({ entry, playing }: any) => (
    <tr data-testid="song-entry" data-playing={playing}>
      Song: {entry.title}
    </tr>
  ),
}));

vi.mock("./MessageEntry", () => ({
  default: ({ children, color, entryRef }: any) => (
    <tr data-testid="message-entry" data-color={color}>
      {children}
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

// Mock icons
vi.mock("@mui/icons-material", () => ({
  Headphones: () => <span data-testid="headphones-icon" />,
  Logout: () => <span data-testid="logout-icon" />,
  Mic: () => <span data-testid="mic-icon" />,
  Timer: () => <span data-testid="timer-icon" />,
  Notifications: () => <span data-testid="notifications-icon" />,
}));

describe("Entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render SongEntry for song entries", () => {
    const songEntry: FlowsheetSongEntry = {
      id: 1,
      entry_type: "song",
      title: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      label: "Test Label",
      show_id: 1,
    } as FlowsheetSongEntry;

    render(
      <table>
        <tbody>
          <Entry entry={songEntry} playing={true} />
        </tbody>
      </table>
    );

    expect(screen.getByTestId("song-entry")).toBeInTheDocument();
    expect(screen.getByTestId("song-entry")).toHaveAttribute("data-playing", "true");
  });

  it("should render start show message for start show entries", () => {
    const startEntry: FlowsheetStartShowEntry = {
      id: 1,
      entry_type: "start_show",
      dj_name: "DJ Cool",
      day: "Monday",
      time: "10:00 AM",
      show_id: 1,
    } as FlowsheetStartShowEntry;

    render(
      <table>
        <tbody>
          <Entry entry={startEntry} playing={false} />
        </tbody>
      </table>
    );

    expect(screen.getByText("DJ Cool")).toBeInTheDocument();
    expect(screen.getByText("started the set")).toBeInTheDocument();
  });

  it("should render end show message for end show entries", () => {
    const endEntry: FlowsheetEndShowEntry = {
      id: 2,
      entry_type: "end_show",
      dj_name: "DJ Awesome",
      day: "Tuesday",
      time: "11:00 PM",
      show_id: 1,
    } as FlowsheetEndShowEntry;

    render(
      <table>
        <tbody>
          <Entry entry={endEntry} playing={false} />
        </tbody>
      </table>
    );

    expect(screen.getByText("DJ Awesome")).toBeInTheDocument();
    expect(screen.getByText("ended the set")).toBeInTheDocument();
  });

  it("should render talkset message for talkset entries", () => {
    const talksetEntry: FlowsheetTalksetEntry = {
      id: 3,
      entry_type: "talkset",
      message: "Welcome to the show!",
      show_id: 1,
    } as FlowsheetTalksetEntry;

    render(
      <table>
        <tbody>
          <Entry entry={talksetEntry} playing={false} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Welcome to the show!")).toBeInTheDocument();
  });

  it("should render breakpoint message for breakpoint entries", () => {
    const breakpointEntry: FlowsheetBreakpointEntry = {
      id: 4,
      entry_type: "breakpoint",
      message: "Station ID",
      show_id: 1,
    } as FlowsheetBreakpointEntry;

    render(
      <table>
        <tbody>
          <Entry entry={breakpointEntry} playing={false} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Station ID")).toBeInTheDocument();
  });

  it("should render generic message for other message entries", () => {
    const messageEntry: FlowsheetMessageEntry = {
      id: 5,
      entry_type: "message",
      message: "Special Announcement",
      show_id: 1,
    } as FlowsheetMessageEntry;

    render(
      <table>
        <tbody>
          <Entry entry={messageEntry} playing={false} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Special Announcement")).toBeInTheDocument();
  });

  it("should pass playing prop to SongEntry", () => {
    const songEntry: FlowsheetSongEntry = {
      id: 1,
      entry_type: "song",
      title: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      label: "Test Label",
      show_id: 1,
    } as FlowsheetSongEntry;

    render(
      <table>
        <tbody>
          <Entry entry={songEntry} playing={false} />
        </tbody>
      </table>
    );

    expect(screen.getByTestId("song-entry")).toHaveAttribute("data-playing", "false");
  });
});
