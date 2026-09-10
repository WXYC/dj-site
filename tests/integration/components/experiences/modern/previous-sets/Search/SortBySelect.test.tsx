import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import type {
  PlaylistSearchState,
  SortField,
  SortOrder,
} from "@/lib/features/playlist-search/frontend";
import SortBySelect from "@/src/components/experiences/modern/previous-sets/Search/SortBySelect";

type SortChoice = {
  label: string;
  sortBy: SortField;
  sortOrder: SortOrder;
};

// Every option the control offers, paired with the sort its own label promises.
const OPTIONS: SortChoice[] = [
  { label: "Date (Newest)", sortBy: "date", sortOrder: "desc" },
  { label: "Date (Oldest)", sortBy: "date", sortOrder: "asc" },
  { label: "Artist (Z-A)", sortBy: "artist", sortOrder: "desc" },
  { label: "Artist (A-Z)", sortBy: "artist", sortOrder: "asc" },
  { label: "DJ (Z-A)", sortBy: "dj", sortOrder: "desc" },
  { label: "DJ (A-Z)", sortBy: "dj", sortOrder: "asc" },
];

const seed = (overrides: Partial<PlaylistSearchState>) => ({
  playlistSearch: { ...playlistSearchSlice.getInitialState(), ...overrides },
});

async function pick(
  user: ReturnType<typeof renderWithProviders>["user"],
  label: string,
) {
  await user.click(screen.getByRole("combobox", { name: "Sort by" }));
  await user.click(screen.getByRole("option", { name: label }));
}

const sortOf = (store: ReturnType<typeof renderWithProviders>["store"]) => ({
  sortBy: playlistSearchSlice.selectors.getSortBy(store.getState()),
  sortOrder: playlistSearchSlice.selectors.getSortOrder(store.getState()),
});

describe("SortBySelect (modern previous sets)", () => {
  // The per-option cases below iterate this file's table, not the control's, so
  // an option added or relabelled in the control would otherwise go unasserted.
  it("offers exactly the options this table describes", async () => {
    const { user } = renderWithProviders(<SortBySelect />);

    await user.click(screen.getByRole("combobox", { name: "Sort by" }));

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(
      OPTIONS.map((o) => o.label),
    );
  });

  it.each(OPTIONS)(
    "applies exactly the sort $label names, from the default listing",
    async ({ label, sortBy, sortOrder }) => {
      const { user, store } = renderWithProviders(<SortBySelect />);

      await pick(user, label);

      expect(sortOf(store)).toEqual({ sortBy, sortOrder });
    },
  );

  it.each(OPTIONS)(
    "applies exactly the sort $label names, from an unrelated active sort",
    async ({ label, sortBy, sortOrder }) => {
      // Seeded on `song`, the one sortable field the dropdown offers no option
      // for, so every row below is a real change rather than a re-pick of the
      // value the control already holds.
      const { user, store } = renderWithProviders(<SortBySelect />, {
        preloadedState: seed({ sortBy: "song", sortOrder: "asc" }),
      });

      await pick(user, label);

      expect(sortOf(store)).toEqual({ sortBy, sortOrder });
    },
  );

  it("re-picking the active option leaves the sort where it is", async () => {
    const { user, store } = renderWithProviders(<SortBySelect />, {
      preloadedState: seed({ sortBy: "artist", sortOrder: "asc" }),
    });

    await pick(user, "Date (Newest)");
    await pick(user, "Date (Newest)");

    expect(sortOf(store)).toEqual({ sortBy: "date", sortOrder: "desc" });
  });

  // The archive begins in November 2004, so a DJ who has landed on an
  // oldest-first listing is twenty-two years from the current show, and getting
  // back rests entirely on this control.
  it.each(OPTIONS.filter((o) => o.sortOrder === "desc"))(
    "escapes an oldest-first listing when $label is chosen",
    async ({ label, sortBy }) => {
      const { user, store } = renderWithProviders(<SortBySelect />, {
        preloadedState: seed({ sortBy: "date", sortOrder: "asc" }),
      });

      await pick(user, label);

      expect(sortOf(store)).toEqual({ sortBy, sortOrder: "desc" });
    },
  );

  it("shows the option matching the sort already in effect", () => {
    renderWithProviders(<SortBySelect />, {
      preloadedState: seed({ sortBy: "artist", sortOrder: "asc" }),
    });

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveTextContent(
      "Artist (A-Z)",
    );
  });
});
