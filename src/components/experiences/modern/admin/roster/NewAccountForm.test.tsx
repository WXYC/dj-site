import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import NewAccountForm from "./NewAccountForm";
import { renderWithProviders } from "@/lib/test-utils";
import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";

// Wrap in table since component renders a <tr>
function renderInTable() {
  return renderWithProviders(
    <table>
      <tbody>
        <form>
          <NewAccountForm />
        </form>
      </tbody>
    </table>
  );
}

describe("NewAccountForm", () => {
  it("should render name input", () => {
    renderInTable();

    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
  });

  it("should render username input", () => {
    renderInTable();

    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
  });

  it("should render DJ name input", () => {
    renderInTable();

    expect(screen.getByPlaceholderText("DJ Name (Optional)")).toBeInTheDocument();
  });

  it("should render email input", () => {
    renderInTable();

    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
  });

  it("should render save button", () => {
    renderInTable();

    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
  });

  it("should have save button with submit type", () => {
    renderInTable();

    expect(screen.getByRole("button", { name: /Save/i })).toHaveAttribute("type", "submit");
  });

  it("should render role select dropdown", () => {
    renderInTable();

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("should default to DJ authorization", () => {
    const { store } = renderInTable();

    const formData = adminSlice.selectors.getFormData(store.getState());
    expect(formData.authorization).toBe(Authorization.DJ);
  });

  it("should update authorization to SM when Station Manager is selected", async () => {
    const { user, store } = renderInTable();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Station Manager" }));

    const formData = adminSlice.selectors.getFormData(store.getState());
    expect(formData.authorization).toBe(Authorization.SM);
  });

  it("should update authorization to MD when Music Director is selected", async () => {
    const { user, store } = renderInTable();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Music Director" }));

    const formData = adminSlice.selectors.getFormData(store.getState());
    expect(formData.authorization).toBe(Authorization.MD);
  });

  it("should have required attributes on name, username, and email inputs", () => {
    renderInTable();

    expect(screen.getByPlaceholderText("Name")).toBeRequired();
    expect(screen.getByPlaceholderText("Username")).toBeRequired();
    expect(screen.getByPlaceholderText("Email")).toBeRequired();
  });

  it("should not require DJ name input", () => {
    renderInTable();

    expect(screen.getByPlaceholderText("DJ Name (Optional)")).not.toBeRequired();
  });

  it("should have email type on email input", () => {
    renderInTable();

    expect(screen.getByPlaceholderText("Email")).toHaveAttribute("type", "email");
  });
});
