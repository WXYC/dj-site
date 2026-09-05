import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import ReviewFilter from "@/src/components/experiences/modern/admin/roster/ReviewFilter";
import { renderWithProviders } from "@/tests/helpers";
import { adminSlice } from "@/lib/features/admin/frontend";

const openMenu = async (user: ReturnType<typeof renderWithProviders>["user"]) => {
  await user.click(screen.getByRole("combobox", { name: "Filter by review status" }));
};

describe("ReviewFilter", () => {
  it("offers both sides of the review queue and the unfiltered roster", async () => {
    const { user } = renderWithProviders(<ReviewFilter />);
    await openMenu(user);

    for (const label of ["All accounts", "Pending review", "Reviewed"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("starts on the whole roster", () => {
    const { store } = renderWithProviders(<ReviewFilter />);

    expect(adminSlice.selectors.getReviewFilter(store.getState())).toBe("all");
    expect(screen.getByRole("combobox", { name: "Filter by review status" })).toHaveTextContent(
      "All accounts"
    );
  });

  it("records the self-signed accounts still awaiting review", async () => {
    const { user, store } = renderWithProviders(<ReviewFilter />);
    await openMenu(user);
    await user.click(screen.getByRole("option", { name: "Pending review" }));

    expect(adminSlice.selectors.getReviewFilter(store.getState())).toBe("pending");
  });

  // A narrowed roster is shorter than the page the admin was standing on.
  it("sends the admin back to the first page", async () => {
    const { user, store } = renderWithProviders(<ReviewFilter />);
    store.dispatch(adminSlice.actions.setPage(3));

    await openMenu(user);
    await user.click(screen.getByRole("option", { name: "Pending review" }));

    expect(adminSlice.selectors.getPage(store.getState())).toBe(0);
  });
});
