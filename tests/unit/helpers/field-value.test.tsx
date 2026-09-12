import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, setFieldValue } from "@/tests/helpers";

describe("setFieldValue", () => {
  it("replaces the field's value in one change event, without dispatching key events", () => {
    const onKeyDown = vi.fn();

    renderWithProviders(
      <input aria-label="album title" defaultValue="" onKeyDown={onKeyDown} />,
    );
    const field = screen.getByLabelText("album title");

    setFieldValue(field, "DOGA");

    expect(field).toHaveValue("DOGA");
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("replaces rather than appends to an existing value", () => {
    renderWithProviders(<input aria-label="label" defaultValue="Drag City" />);
    const field = screen.getByLabelText("label");

    setFieldValue(field, "Sonamos");

    expect(field).toHaveValue("Sonamos");
  });
});
