import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlowsheetSearchInput from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchInput";

const mockSetSearchProperty = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: vi.fn(() => ({
    getDisplayValue: (_name: string) => "",
    setSearchProperty: mockSetSearchProperty,
    selectedIndex: 0,
    selectedEntry: null,
  })),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    actions: {
      freezeSelectionToQuery: vi.fn((payload) => ({
        type: "freezeSelectionToQuery",
        payload,
      })),
    },
  },
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
    fireEvent.change(input, { target: { value: "Juana Molina" } });

    expect(mockSetSearchProperty).toHaveBeenCalledWith("artist", "Juana Molina");
  });

  it("should display value from getDisplayValue", async () => {
    const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useFlowsheetSearch).mockReturnValue({
      getDisplayValue: () => "DOGA",
      setSearchProperty: mockSetSearchProperty,
      selectedIndex: 0,
      selectedEntry: null,
    } as any);

    render(<FlowsheetSearchInput name="album" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("DOGA");
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

  describe("editing an auto-filled field", () => {
    async function selectResult() {
      const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
      vi.mocked(useFlowsheetSearch).mockReturnValue({
        getDisplayValue: (name: string) => {
          switch (name) {
            case "artist":
              return "Juana Molina";
            case "album":
              return "DOGA";
            case "label":
              return "Sonamos";
            default:
              return "";
          }
        },
        setSearchProperty: mockSetSearchProperty,
        selectedIndex: 1,
        selectedEntry: {
          id: 42,
          artist: { name: "Juana Molina" },
          title: "DOGA",
          label: "Sonamos",
        },
      } as any);
    }

    it("should not be readonly so the user can edit on click", async () => {
      await selectResult();

      render(<FlowsheetSearchInput name="artist" />);

      const input = screen.getByRole("textbox");
      expect(input).not.toHaveAttribute("readonly");
    });

    it("should freeze the selected entry's fields into the query before applying the edit", async () => {
      await selectResult();
      const { flowsheetSlice } = await import(
        "@/lib/features/flowsheet/frontend"
      );

      render(<FlowsheetSearchInput name="artist" />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Juana M" } });

      expect(flowsheetSlice.actions.freezeSelectionToQuery).toHaveBeenCalledWith({
        artist: "Juana Molina",
        album: "DOGA",
        label: "Sonamos",
        album_id: 42,
        rotation_id: undefined,
        rotation_bin: undefined,
      });
      expect(mockSetSearchProperty).toHaveBeenCalledWith("artist", "Juana M");
    });

    it("should preserve rotation_id and rotation_bin from a rotation/bin selection", async () => {
      const { useFlowsheetSearch } = await import(
        "@/src/hooks/flowsheetHooks"
      );
      vi.mocked(useFlowsheetSearch).mockReturnValue({
        getDisplayValue: (name: string) =>
          name === "artist" ? "Juana Molina" : "",
        setSearchProperty: mockSetSearchProperty,
        selectedIndex: 1,
        selectedEntry: {
          id: 42,
          artist: { name: "Juana Molina" },
          title: "DOGA",
          label: "Sonamos",
          rotation_id: 7,
          rotation_bin: "H",
        },
      } as any);
      const { flowsheetSlice } = await import(
        "@/lib/features/flowsheet/frontend"
      );

      render(<FlowsheetSearchInput name="artist" />);

      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Juana M" },
      });

      expect(flowsheetSlice.actions.freezeSelectionToQuery).toHaveBeenCalledWith({
        artist: "Juana Molina",
        album: "DOGA",
        label: "Sonamos",
        album_id: 42,
        rotation_id: 7,
        rotation_bin: "H",
      });
    });

    it("should not block keystrokes when auto-filled", async () => {
      await selectResult();

      render(<FlowsheetSearchInput name="artist" />);

      const input = screen.getByRole("textbox");

      // None of these should be prevented now — typing thaws the selection.
      expect(fireEvent.keyDown(input, { key: "a" })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "Backspace" })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    });
  });

  describe("ghost text", () => {
    async function resetToDefaultMock() {
      const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
      vi.mocked(useFlowsheetSearch).mockReturnValue({
        getDisplayValue: () => "",
        setSearchProperty: mockSetSearchProperty,
        selectedIndex: 0,
        selectedEntry: null,
      } as any);
    }

    it("should render ghost text suffix when provided", async () => {
      await resetToDefaultMock();

      render(
        <FlowsheetSearchInput name="artist" ghostSuffix="techre" />
      );

      expect(screen.getByTestId("ghost-text-artist")).toBeInTheDocument();
      expect(screen.getByTestId("ghost-text-artist")).toHaveTextContent("techre");
    });

    it("should not render ghost text when suffix is empty", async () => {
      await resetToDefaultMock();

      render(
        <FlowsheetSearchInput name="artist" ghostSuffix="" />
      );

      expect(screen.queryByTestId("ghost-text-artist")).not.toBeInTheDocument();
    });

    it("should not render ghost text when field is auto-filled", async () => {
      const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
      vi.mocked(useFlowsheetSearch).mockReturnValue({
        getDisplayValue: () => "Juana Molina",
        setSearchProperty: mockSetSearchProperty,
        selectedIndex: 1,
        selectedEntry: {
          artist: { name: "Juana Molina" },
        },
      } as any);

      render(
        <FlowsheetSearchInput name="artist" ghostSuffix="techre" />
      );

      expect(screen.queryByTestId("ghost-text-artist")).not.toBeInTheDocument();
    });

    it("should call onAcceptGhost on ArrowRight at the caret end", async () => {
      const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
      vi.mocked(useFlowsheetSearch).mockReturnValue({
        getDisplayValue: () => "Stereo",
        setSearchProperty: mockSetSearchProperty,
        selectedIndex: 0,
        selectedEntry: null,
      } as any);
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          ghostSuffix="lab"
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.setSelectionRange(input.value.length, input.value.length);
      fireEvent.keyDown(input, { key: "ArrowRight" });

      expect(onAcceptGhost).toHaveBeenCalledTimes(1);
    });

    it("should not accept on ArrowRight while the caret is mid-text", async () => {
      const { useFlowsheetSearch } = await import("@/src/hooks/flowsheetHooks");
      vi.mocked(useFlowsheetSearch).mockReturnValue({
        getDisplayValue: () => "Stereo",
        setSearchProperty: mockSetSearchProperty,
        selectedIndex: 0,
        selectedEntry: null,
      } as any);
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          ghostSuffix="lab"
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.setSelectionRange(2, 2);
      fireEvent.keyDown(input, { key: "ArrowRight" });

      expect(onAcceptGhost).not.toHaveBeenCalled();
    });

    it("should not accept on Tab — Tab is field navigation only", async () => {
      await resetToDefaultMock();
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          ghostSuffix="techre"
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox");
      const notPrevented = fireEvent.keyDown(input, { key: "Tab" });

      expect(onAcceptGhost).not.toHaveBeenCalled();
      expect(notPrevented).toBe(true);
    });

    it("should not call onAcceptGhost when Tab pressed without ghost text", async () => {
      await resetToDefaultMock();
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          ghostSuffix=""
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input, { key: "Tab" });

      expect(onAcceptGhost).not.toHaveBeenCalled();
    });
  });
});
