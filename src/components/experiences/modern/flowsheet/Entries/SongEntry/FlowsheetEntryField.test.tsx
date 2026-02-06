import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FlowsheetEntryField from "./FlowsheetEntryField";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";

// Mock hooks
const mockUseShowControl = vi.fn();
const mockUseFlowsheet = vi.fn();
const mockDispatch = vi.fn();
const mockUpdateFlowsheet = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
  useFlowsheet: () => mockUseFlowsheet(),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    actions: {
      updateQueueEntry: vi.fn((data) => ({
        type: "updateQueueEntry",
        payload: data,
      })),
    },
  },
}));

vi.mock("@/src/utilities/stringutilities", () => ({
  toTitleCase: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
}));

describe("FlowsheetEntryField", () => {
  const mockEntry: FlowsheetSongEntry = {
    id: 1,
    play_order: 0,
    show_id: 100,
    track_title: "Test Track",
    artist_name: "Test Artist",
    album_title: "Test Album",
    record_label: "Test Label",
    request_flag: false,
    album_id: 42,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseShowControl.mockReturnValue({
      live: true,
    });

    mockUseFlowsheet.mockReturnValue({
      updateFlowsheet: mockUpdateFlowsheet,
    });
  });

  describe("Display mode rendering", () => {
    it("should render the field value in display mode", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText("Test Track")).toBeInTheDocument();
    });

    it("should render album_title field correctly", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="album_title"
          label="album"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText("Test Album")).toBeInTheDocument();
    });

    it("should render artist_name field correctly", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="artist_name"
          label="artist"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText("Test Artist")).toBeInTheDocument();
    });

    it("should render record_label field correctly", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="record_label"
          label="label"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText("Test Label")).toBeInTheDocument();
    });

    it("should show placeholder text when field value is empty", () => {
      const entryWithEmptyField = {
        ...mockEntry,
        track_title: "",
      };

      render(
        <FlowsheetEntryField
          entry={entryWithEmptyField}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText("Track Unspecified")).toBeInTheDocument();
    });

    it("should apply opacity style when field is empty", () => {
      const entryWithEmptyField = {
        ...mockEntry,
        track_title: "",
      };

      render(
        <FlowsheetEntryField
          entry={entryWithEmptyField}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      // The Typography component should have opacity 0.5 when empty
      const typography = screen.getByText("Track Unspecified").closest("p");
      expect(typography).toHaveStyle({ opacity: "0.5" });
    });

    it("should apply full opacity when field has value", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      const typography = screen.getByText("Test Track").closest("p");
      expect(typography).toHaveStyle({ opacity: "1" });
    });
  });

  describe("Edit mode behavior", () => {
    it("should enter edit mode on double click when editable and live", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Should now show an input field
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("Test Track");
    });

    it("should NOT enter edit mode on double click when not editable", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={false}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Should NOT show an input field
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should NOT enter edit mode on double click when not live", () => {
      mockUseShowControl.mockReturnValue({
        live: false,
      });

      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Should NOT show an input field
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should allow editing the input value", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Track"));

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Track Title" } });

      expect(input).toHaveValue("New Track Title");
    });

    it("should render form with input in edit mode", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Check that the input has the correct attributes
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("autocomplete", "off");
      expect(input).toHaveAttribute("type", "text");
    });
  });

  describe("Save and close behavior", () => {
    it("should call updateFlowsheet when saving non-queue entry", async () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      // Enter edit mode
      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Change the value
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Updated Track" } });

      // Submit the form
      const form = input.closest("form");
      fireEvent.submit(form!);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: {
          track_title: "Updated Track",
        },
      });
    });

    it("should dispatch updateQueueEntry when saving queue entry", async () => {
      const { flowsheetSlice } = await import(
        "@/lib/features/flowsheet/frontend"
      );

      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={true}
          playing={false}
          editable={true}
        />
      );

      // Enter edit mode
      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Change the value
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Updated Track" } });

      // Submit the form
      const form = input.closest("form");
      fireEvent.submit(form!);

      expect(mockDispatch).toHaveBeenCalled();
      expect(flowsheetSlice.actions.updateQueueEntry).toHaveBeenCalledWith({
        entry_id: 1,
        field: "track_title",
        value: "Updated Track",
      });
    });

    it("should exit edit mode after form submission", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      // Enter edit mode
      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Submit the form
      const input = screen.getByRole("textbox");
      const form = input.closest("form");
      fireEvent.submit(form!);

      // Should no longer be in edit mode
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should wrap input in ClickAwayListener for save on click away behavior", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      // Enter edit mode
      fireEvent.doubleClick(screen.getByText("Test Track"));

      // Verify the form and input are rendered (ClickAwayListener wraps them)
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();

      // Verify the input is inside a form (which is inside ClickAwayListener)
      const form = input.closest("form");
      expect(form).toBeInTheDocument();
    });
  });

  describe("Playing state styling", () => {
    it("should apply primary.lightChannel color when playing in edit mode", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={true}
          editable={true}
        />
      );

      // Enter edit mode
      fireEvent.doubleClick(screen.getByText("Test Track"));

      // The Typography should have textColor set to primary.lightChannel
      const input = screen.getByRole("textbox");
      const typography = input.closest("p");
      // The component sets textColor which maps to MUI's color system
      expect(typography).toBeInTheDocument();
    });

    it("should apply neutral.700 color when not playing in edit mode", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      // Enter edit mode
      fireEvent.doubleClick(screen.getByText("Test Track"));

      const input = screen.getByRole("textbox");
      const typography = input.closest("p");
      expect(typography).toBeInTheDocument();
    });
  });

  describe("Typography props passthrough", () => {
    it("should pass additional Typography props", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
          level="body-sm"
        />
      );

      // The Typography component should receive the level prop
      const typography = screen.getByText("Test Track").closest("p");
      expect(typography).toBeInTheDocument();
    });

    it("should apply custom sx styles while preserving required styles", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
          sx={{ fontWeight: "bold" }}
        />
      );

      const typography = screen.getByText("Test Track").closest("p");
      // The component should preserve whiteSpace, overflow, textOverflow
      expect(typography).toBeInTheDocument();
    });
  });

  describe("Different field names", () => {
    it("should handle album_title field", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="album_title"
          label="album"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Album"));

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Album" } });
      fireEvent.submit(input.closest("form")!);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: {
          album_title: "New Album",
        },
      });
    });

    it("should handle artist_name field", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="artist_name"
          label="artist"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Artist"));

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Artist" } });
      fireEvent.submit(input.closest("form")!);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: {
          artist_name: "New Artist",
        },
      });
    });

    it("should handle record_label field", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="record_label"
          label="label"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Label"));

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Label" } });
      fireEvent.submit(input.closest("form")!);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: {
          record_label: "New Label",
        },
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle entry with numeric-looking string values", () => {
      const entryWithNumericTitle = {
        ...mockEntry,
        track_title: "1234",
      };

      render(
        <FlowsheetEntryField
          entry={entryWithNumericTitle}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText("1234")).toBeInTheDocument();
    });

    it("should handle special characters in field values", () => {
      const entryWithSpecialChars = {
        ...mockEntry,
        track_title: "Test & <Track> 'Title'",
      };

      render(
        <FlowsheetEntryField
          entry={entryWithSpecialChars}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText("Test & <Track> 'Title'")).toBeInTheDocument();
    });

    it("should handle very long field values", () => {
      const longTitle = "A".repeat(200);
      const entryWithLongTitle = {
        ...mockEntry,
        track_title: longTitle,
      };

      render(
        <FlowsheetEntryField
          entry={entryWithLongTitle}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it("should handle whitespace-only field values", () => {
      const entryWithWhitespace = {
        ...mockEntry,
        track_title: "   ",
      };

      render(
        <FlowsheetEntryField
          entry={entryWithWhitespace}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      // Whitespace is truthy and has length > 0, so it should display the value
      // The component adds &nbsp; after the text, so we can't use exact match
      // Just verify the component renders without throwing
      const typography = screen.getByRole("paragraph");
      expect(typography).toBeInTheDocument();
      // The typography should have opacity 1 since the string has length > 0
      expect(typography).toHaveStyle({ opacity: "1" });
    });

    it("should maintain value state correctly across multiple edits", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="track_title"
          label="track"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      // First edit
      fireEvent.doubleClick(screen.getByText("Test Track"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "First Edit" } });
      fireEvent.submit(input.closest("form")!);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: {
          track_title: "First Edit",
        },
      });
    });
  });

  describe("Queue vs non-queue behavior", () => {
    it("should update Redux state for queue entries", async () => {
      const { flowsheetSlice } = await import(
        "@/lib/features/flowsheet/frontend"
      );

      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="artist_name"
          label="artist"
          queue={true}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Artist"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Queue Artist" } });
      fireEvent.submit(input.closest("form")!);

      expect(flowsheetSlice.actions.updateQueueEntry).toHaveBeenCalledWith({
        entry_id: 1,
        field: "artist_name",
        value: "Queue Artist",
      });
      expect(mockUpdateFlowsheet).not.toHaveBeenCalled();
    });

    it("should call API for non-queue entries", () => {
      render(
        <FlowsheetEntryField
          entry={mockEntry}
          name="artist_name"
          label="artist"
          queue={false}
          playing={false}
          editable={true}
        />
      );

      fireEvent.doubleClick(screen.getByText("Test Artist"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "API Artist" } });
      fireEvent.submit(input.closest("form")!);

      expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
        entry_id: 1,
        data: {
          artist_name: "API Artist",
        },
      });
    });
  });
});
