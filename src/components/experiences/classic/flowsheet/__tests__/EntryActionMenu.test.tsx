import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import EntryActionMenu from "../EntryActionMenu";

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

  it("renders the dropdown hidden by default", () => {
    const { container } = setUp();
    const menu = container.querySelector(".action-menu");
    expect(menu).not.toBeNull();
    expect(menu!.classList.contains("open")).toBe(false);
  });

  it("opens the dropdown on trigger click", () => {
    const { container } = setUp();
    const trigger = screen.getByRole("button", { name: /actions/i });
    fireEvent.click(trigger);
    const menu = container.querySelector(".action-menu");
    expect(menu!.classList.contains("open")).toBe(true);
  });

  it("closes the dropdown on second trigger click", () => {
    const { container } = setUp();
    const trigger = screen.getByRole("button", { name: /actions/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    const menu = container.querySelector(".action-menu");
    expect(menu!.classList.contains("open")).toBe(false);
  });

  it("fires onEdit and closes the menu when Edit is clicked", () => {
    const { container, props } = setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));
    expect(props.onEdit).toHaveBeenCalledWith(42);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
  });

  it("fires onDelete and closes the menu when Delete is clicked", () => {
    const { container, props } = setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Delete"));
    expect(props.onDelete).toHaveBeenCalledWith(42);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
  });

  it("marks the Delete item with the action-delete class for red styling", () => {
    setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    const del = screen.getByText("Delete");
    expect(del.classList.contains("action-delete")).toBe(true);
  });

  it("closes the dropdown when clicking outside the menu", () => {
    const { container } = setUp();
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(true);
    fireEvent.mouseDown(document.body);
    expect(container.querySelector(".action-menu")!.classList.contains("open")).toBe(false);
  });
});
