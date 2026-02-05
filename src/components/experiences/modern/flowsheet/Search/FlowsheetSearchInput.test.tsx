import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlowsheetSearchInput from "./FlowsheetSearchInput";

// Mock hooks
const mockSetSearchProperty = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: vi.fn(() => ({
    getDisplayValue: (name: string) => "",
    setSearchProperty: mockSetSearchProperty,
    selectedIndex: 0,
    selectedEntry: null,
  })),
}));

vi.mock("@/src/utilities/stringutilities", () => ({
  toTitleCase: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
}));

describe("FlowsheetSearchInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render input with correct name", () => {
    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "artist");
  });

  it("should render with title case placeholder", () => {
    render(<FlowsheetSearchInput name="song" />);

    expect(screen.getByPlaceholderText("Song")).toBeInTheDocument();
  });

  it("should call setSearchProperty on change", () => {
    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Test Artist" } });

    expect(mockSetSearchProperty).toHaveBeenCalledWith("artist", "Test Artist");
  });

  it("should display value from getDisplayValue", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Existing Value",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 0,
      selectedEntry: null,
    } as any);

    render(<FlowsheetSearchInput name="album" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Existing Value");
  });

  it("should be readonly when field is auto-filled", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Auto-filled value",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        artist: { name: "Test Artist" },
      },
    } as any);

    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("readonly");
  });

  it("should not be readonly for song field even when selected", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Song title",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        title: "Test Album",
      },
    } as any);

    render(<FlowsheetSearchInput name="song" />);

    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("readonly");
  });

  it("should stop click propagation", () => {
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <FlowsheetSearchInput name="artist" />
      </div>
    );

    const input = screen.getByRole("textbox");
    fireEvent.click(input);

    expect(parentClick).not.toHaveBeenCalled();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<FlowsheetSearchInput name="artist" disabled />);

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("should have autocomplete off", () => {
    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("should pass through additional props", () => {
    render(
      <FlowsheetSearchInput
        name="artist"
        data-custom="value"
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("data-custom", "value");
  });

  it("should be readonly when album field is auto-filled", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Auto-filled Album",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        title: "Test Album Title",
      },
    } as any);

    render(<FlowsheetSearchInput name="album" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("readonly");
  });

  it("should be readonly when label field is auto-filled", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Auto-filled Label",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        label: "Test Label",
      },
    } as any);

    render(<FlowsheetSearchInput name="label" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("readonly");
  });

  it("should prevent keydown when auto-filled except Tab and Shift", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Auto-filled value",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        artist: { name: "Test Artist" },
      },
    } as any);

    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");

    // Regular key should be prevented
    const letterEvent = fireEvent.keyDown(input, { key: 'a' });
    // Tab should not be prevented
    const tabEvent = fireEvent.keyDown(input, { key: 'Tab' });
    // Shift should not be prevented
    const shiftEvent = fireEvent.keyDown(input, { key: 'Shift' });

    expect(input).toHaveAttribute("readonly");
  });

  it("should not call setSearchProperty when auto-filled", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Auto-filled value",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        artist: { name: "Test Artist" },
      },
    } as any);

    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Value" } });

    // Should not be called because field is auto-filled
    expect(mockSetSearchProperty).not.toHaveBeenCalled();
  });

  it("should apply auto-fill styles when field is auto-filled", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "Auto-filled value",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        artist: { name: "Test Artist" },
      },
    } as any);

    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveStyle({ cursor: "not-allowed", opacity: "0.6" });
  });

  it("should not be readonly when selectedEntry has no value for field", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        // No artist name
        artist: null,
      },
    } as any);

    render(<FlowsheetSearchInput name="artist" />);

    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("readonly");
  });

  it("should not be readonly when album field has no title", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        title: "", // empty title
      },
    } as any);

    render(<FlowsheetSearchInput name="album" />);

    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("readonly");
  });

  it("should not be readonly when label field has no label", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 1,
      selectedEntry: {
        label: null,
      },
    } as any);

    render(<FlowsheetSearchInput name="label" />);

    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("readonly");
  });
});
