import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { parseSmartEntry } from "@/src/components/experiences/modern/flowsheet/SmartEntry/parser/parseSmartEntry";
import SmartComposer from "@/src/components/experiences/modern/flowsheet/SmartEntry/SmartComposer";

const renderComposer = (raw: string, props = {}) => {
  const parse = parseSmartEntry(raw);
  const onChange = vi.fn();
  const onKeyDown = vi.fn();
  const result = renderWithProviders(
    <SmartComposer
      raw={raw}
      spans={parse.spans}
      pendingTrigger={parse.pendingTrigger}
      onChange={onChange}
      onKeyDown={onKeyDown}
      {...props}
    />
  );
  return { ...result, onChange, onKeyDown };
};

describe("SmartComposer", () => {
  it("exposes the textarea as a combobox with an accessible label", () => {
    const { getByRole } = renderComposer("");
    const textarea = getByRole("combobox");
    expect(textarea).toHaveAttribute("aria-label", "Flowsheet entry");
  });

  it("shows a placeholder when empty", () => {
    const { getByRole } = renderComposer("");
    expect(getByRole("combobox")).toHaveAttribute("placeholder");
  });

  it("renders the mirror content covering the raw text", () => {
    // The mirror splits text into spans; the full text is present in the DOM.
    const { container } = renderComposer("Percolator by Stereolab");
    expect(container.textContent).toContain("Percolator");
    expect(container.textContent).toContain("by");
    expect(container.textContent).toContain("Stereolab");
  });

  it("strips newlines from input changes (Enter commits, never inserts)", () => {
    const { getByRole, onChange } = renderComposer("Perc");
    fireEvent.change(getByRole("combobox"), {
      target: { value: "Perc\nolator" },
    });
    expect(onChange).toHaveBeenCalledWith("Percolator");
  });

  it("forwards keydown events", () => {
    const { getByRole, onKeyDown } = renderComposer("Perc");
    fireEvent.keyDown(getByRole("combobox"), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("disables the textarea when disabled", () => {
    const { getByRole } = renderComposer("", { disabled: true });
    expect(getByRole("combobox")).toBeDisabled();
  });

  it("reflects the expanded state via aria-expanded", () => {
    const { getByRole } = renderComposer("Perc", { expanded: true });
    expect(getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
  });
});
