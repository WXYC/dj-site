import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import OnboardingFilter from "@/src/components/experiences/modern/admin/roster/OnboardingFilter";
import { renderWithProviders } from "@/tests/helpers";
import { adminSlice } from "@/lib/features/admin/frontend";

const openMenu = async (user: ReturnType<typeof renderWithProviders>["user"]) => {
  await user.click(screen.getByRole("combobox", { name: "Filter by onboarding status" }));
};

describe("OnboardingFilter", () => {
  it("offers both sides of the signup flow and the unfiltered roster", async () => {
    const { user } = renderWithProviders(<OnboardingFilter />);
    await openMenu(user);

    for (const label of ["All accounts", "Onboarding incomplete", "Onboarding complete"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("starts on the whole roster", () => {
    const { store } = renderWithProviders(<OnboardingFilter />);

    expect(adminSlice.selectors.getOnboardingFilter(store.getState())).toBe("all");
    expect(
      screen.getByRole("combobox", { name: "Filter by onboarding status" })
    ).toHaveTextContent("All accounts");
  });

  it("records the DJs who never finished signing up", async () => {
    const { user, store } = renderWithProviders(<OnboardingFilter />);
    await openMenu(user);
    await user.click(screen.getByRole("option", { name: "Onboarding incomplete" }));

    expect(adminSlice.selectors.getOnboardingFilter(store.getState())).toBe("incomplete");
  });

  // A narrowed roster is shorter than the page the admin was standing on.
  it("sends the admin back to the first page", async () => {
    const { user, store } = renderWithProviders(<OnboardingFilter />);
    store.dispatch(adminSlice.actions.setPage(3));

    await openMenu(user);
    await user.click(screen.getByRole("option", { name: "Onboarding incomplete" }));

    expect(adminSlice.selectors.getPage(store.getState())).toBe(0);
  });
});
