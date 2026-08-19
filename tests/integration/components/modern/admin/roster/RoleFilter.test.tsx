import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import RoleFilter from "@/src/components/experiences/modern/admin/roster/RoleFilter";
import { renderWithProviders } from "@/tests/helpers";
import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";

const openMenu = async (user: ReturnType<typeof renderWithProviders>["user"]) => {
  await user.click(screen.getByRole("combobox", { name: "Filter by role" }));
};

describe("RoleFilter", () => {
  it("offers every station role", async () => {
    const { user } = renderWithProviders(<RoleFilter />);
    await openMenu(user);

    for (const label of ["Member", "DJ", "Music Director", "Station Manager"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("shows no selection as every role rather than none", () => {
    const { store } = renderWithProviders(<RoleFilter />);

    expect(adminSlice.selectors.getRoleFilter(store.getState())).toEqual([]);
    expect(screen.getByText("All roles")).toBeInTheDocument();
  });

  it("records the selected roles", async () => {
    const { user, store } = renderWithProviders(<RoleFilter />);
    await openMenu(user);
    await user.click(screen.getByRole("option", { name: "Music Director" }));

    expect(adminSlice.selectors.getRoleFilter(store.getState())).toEqual([Authorization.MD]);
  });

  it("selects more than one role at a time", async () => {
    const { user, store } = renderWithProviders(<RoleFilter />);
    await openMenu(user);
    await user.click(screen.getByRole("option", { name: "DJ" }));
    await user.click(screen.getByRole("option", { name: "Station Manager" }));

    expect(adminSlice.selectors.getRoleFilter(store.getState())).toEqual([
      Authorization.DJ,
      Authorization.SM,
    ]);
  });

  // A narrowed roster is shorter than the page the admin was standing on.
  it("sends the admin back to the first page", async () => {
    const { user, store } = renderWithProviders(<RoleFilter />);
    store.dispatch(adminSlice.actions.setPage(3));

    await openMenu(user);
    await user.click(screen.getByRole("option", { name: "DJ" }));

    expect(adminSlice.selectors.getPage(store.getState())).toBe(0);
  });
});
