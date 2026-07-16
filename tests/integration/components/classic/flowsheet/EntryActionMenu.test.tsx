import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import EntryActionMenu from "@/src/components/experiences/classic/flowsheet/EntryActionMenu";

function setUp(overrides: Partial<React.ComponentProps<typeof EntryActionMenu>> = {}) {
  const props = {
    entryId: 42,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const result = renderWithProviders(<EntryActionMenu {...props} />);
  return { ...result, props };
}

describe("Classic EntryActionMenu", () => {
  it("renders an ellipsis trigger button with an aria-label", () => {
    setUp();
    const trigger = screen.getByRole("button", { name: /actions/i });
    expect(trigger).toBeDefined();
    expect(trigger.textContent).toBe("⋯");
  });

  it("exposes menu disclosure semantics on the trigger button", () => {
    setUp();
    const trigger = screen.getByRole("button", { name: /actions/i });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not render the dropdown items in the DOM by default", () => {
    const { container } = setUp();
    expect(container.querySelector(".action-dropdown")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("opens the dropdown on trigger click and flips aria-expanded", () => {
    const { container } = setUp();
    const trigger = screen.getByRole("button", { name: /actions/i });
    fireEvent.click(trigger);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(true);
    expect(container.querySelector(".action-dropdown")).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes the dropdown on second trigger click", () => {
    const { container } = setUp();
    const trigger = screen.getByRole("button", { name: /actions/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
    expect(container.querySelector(".action-dropdown")).toBeNull();
  });

  it("fires onEdit and closes the menu when Edit is clicked", () => {
    const { container, props } = setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(props.onEdit).toHaveBeenCalledWith(42);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
  });

  it("fires onDelete and closes the menu when Delete is clicked", () => {
    const { container, props } = setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(props.onDelete).toHaveBeenCalledWith(42);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
  });

  it("renders the dropdown items as <button> elements (not anchors)", () => {
    setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(screen.getByRole("menuitem", { name: "Edit" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("menuitem", { name: "Delete" }).tagName).toBe("BUTTON");
  });

  it("marks the Delete item with the action-delete class for red styling", () => {
    setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    const del = screen.getByRole("menuitem", { name: "Delete" });
    expect(del.classList.contains("action-delete")).toBe(true);
  });

  it("closes the dropdown on outside pointerdown", () => {
    const { container } = setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
  });

  it("closes the dropdown when Escape is pressed", () => {
    const { container } = setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
  });
});
