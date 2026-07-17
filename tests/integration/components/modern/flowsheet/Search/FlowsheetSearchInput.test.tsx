import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlowsheetSearchInput from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchInput";

const mockDispatch = vi.fn();

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    actions: {
      setSearchProperty: vi.fn((payload) => ({
        type: "setSearchProperty",
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
    render(<FlowsheetSearchInput name="artist" value="" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "artist");
  });

  it("should render with title case placeholder", () => {
    render(<FlowsheetSearchInput name="song" value="" />);

    expect(screen.getByPlaceholderText("Song")).toBeInTheDocument();
  });

  it("should dispatch setSearchProperty on change", () => {
    render(<FlowsheetSearchInput name="artist" value="" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Juana Molina" } });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "setSearchProperty",
      payload: { name: "artist", value: "Juana Molina" },
    });
  });

  it("should display the value prop", () => {
    render(<FlowsheetSearchInput name="album" value="DOGA" />);

    expect(screen.getByRole("textbox")).toHaveValue("DOGA");
  });

  it("should stop click propagation", () => {
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <FlowsheetSearchInput name="artist" value="" />
      </div>
    );

    const input = screen.getByRole("textbox");
    fireEvent.click(input);

    expect(parentClick).not.toHaveBeenCalled();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<FlowsheetSearchInput name="artist" value="" disabled />);

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("should have autocomplete off", () => {
    render(<FlowsheetSearchInput name="artist" value="" />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("should pass through additional props", () => {
    render(
      <FlowsheetSearchInput name="artist" value="" data-custom="value" />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("data-custom", "value");
  });

  describe("editing an auto-filled field", () => {
    it("should not be readonly so the user can edit on click", () => {
      render(
        <FlowsheetSearchInput
          name="artist"
          value="Juana Molina"
          isAutoFilled
          onThaw={vi.fn()}
        />
      );

      const input = screen.getByRole("textbox");
      expect(input).not.toHaveAttribute("readonly");
    });

    it("should thaw before applying the edit", () => {
      const onThaw = vi.fn();
      render(
        <FlowsheetSearchInput
          name="artist"
          value="Juana Molina"
          isAutoFilled
          onThaw={onThaw}
        />
      );

      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Juana M" },
      });

      expect(onThaw).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "setSearchProperty",
        payload: { name: "artist", value: "Juana M" },
      });
    });

    it("should not thaw when the value is the DJ's own", () => {
      const onThaw = vi.fn();
      render(
        <FlowsheetSearchInput name="artist" value="Juana" onThaw={onThaw} />
      );

      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "Juana M" },
      });

      expect(onThaw).not.toHaveBeenCalled();
    });

    it("should not block keystrokes when auto-filled", () => {
      render(
        <FlowsheetSearchInput
          name="artist"
          value="Juana Molina"
          isAutoFilled
          onThaw={vi.fn()}
        />
      );

      const input = screen.getByRole("textbox");

      expect(fireEvent.keyDown(input, { key: "a" })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "Backspace" })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    });
  });

  describe("ghost text", () => {
    it("should render ghost text suffix when provided", () => {
      render(
        <FlowsheetSearchInput name="artist" value="Au" ghostSuffix="techre" />
      );

      expect(screen.getByTestId("ghost-text-artist")).toBeInTheDocument();
      expect(screen.getByTestId("ghost-text-artist")).toHaveTextContent(
        "techre"
      );
    });

    it("should not render ghost text when suffix is empty", () => {
      render(<FlowsheetSearchInput name="artist" value="Au" ghostSuffix="" />);

      expect(
        screen.queryByTestId("ghost-text-artist")
      ).not.toBeInTheDocument();
    });

    it("should not render ghost text when field is auto-filled", () => {
      render(
        <FlowsheetSearchInput
          name="artist"
          value="Juana Molina"
          isAutoFilled
          ghostSuffix="techre"
        />
      );

      expect(
        screen.queryByTestId("ghost-text-artist")
      ).not.toBeInTheDocument();
    });

    it("should call onAcceptGhost on ArrowRight at the caret end", () => {
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          value="Stereo"
          ghostSuffix="lab"
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.setSelectionRange(input.value.length, input.value.length);
      fireEvent.keyDown(input, { key: "ArrowRight" });

      expect(onAcceptGhost).toHaveBeenCalledTimes(1);
    });

    it("should not accept on ArrowRight while the caret is mid-text", () => {
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          value="Stereo"
          ghostSuffix="lab"
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.setSelectionRange(2, 2);
      fireEvent.keyDown(input, { key: "ArrowRight" });

      expect(onAcceptGhost).not.toHaveBeenCalled();
    });

    it("should not accept on Tab — Tab is field navigation only", () => {
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          value="Au"
          ghostSuffix="techre"
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox");
      const notPrevented = fireEvent.keyDown(input, { key: "Tab" });

      expect(onAcceptGhost).not.toHaveBeenCalled();
      expect(notPrevented).toBe(true);
    });

    it("should not call onAcceptGhost without ghost text", () => {
      const onAcceptGhost = vi.fn();

      render(
        <FlowsheetSearchInput
          name="artist"
          value="Au"
          ghostSuffix=""
          onAcceptGhost={onAcceptGhost}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.setSelectionRange(2, 2);
      fireEvent.keyDown(input, { key: "ArrowRight" });

      expect(onAcceptGhost).not.toHaveBeenCalled();
    });
  });
});
