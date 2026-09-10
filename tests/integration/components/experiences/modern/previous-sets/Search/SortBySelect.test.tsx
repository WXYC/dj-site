import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import type { PlaylistSearchState } from "@/lib/features/playlist-search/frontend";
import SortBySelect from "@/src/components/experiences/modern/previous-sets/Search/SortBySelect";

type SortChoice = {
  label: string;
  sortBy: PlaylistSearchState["sortBy"];
  sortOrder: PlaylistSearchState["sortOrder"];
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
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: label }));
}

const sortOf = (store: ReturnType<typeof renderWithProviders>["store"]) => ({
  sortBy: playlistSearchSlice.selectors.getSortBy(store.getState()),
  sortOrder: playlistSearchSlice.selectors.getSortOrder(store.getState()),
});

describe("SortBySelect (modern previous sets)", () => {
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
      const { user, store } = renderWithProviders(<SortBySelect />, {
        preloadedState: seed({ sortBy: "dj", sortOrder: "desc" }),
      });

      await pick(user, label);

      expect(sortOf(store)).toEqual({ sortBy, sortOrder });
    },
  );

  it("re-picking the active option leaves the sort where it is", async () => {
    const { user, store } = renderWithProviders(<SortBySelect />);

    await pick(user, "Date (Newest)");
    await pick(user, "Date (Newest)");

    expect(sortOf(store)).toEqual({ sortBy: "date", sortOrder: "desc" });
  });

  // The archive begins in November 2004, so an unasked-for ascending date sort
  // buries today's plays thousands of pages deep.
  it("never lands on oldest-first unless the chosen label asks for it", async () => {
    for (const option of OPTIONS.filter((o) => o.sortOrder === "desc")) {
      const { user, store, unmount } = renderWithProviders(<SortBySelect />);

      await pick(user, option.label);

      expect(sortOf(store).sortOrder).toBe("desc");
      unmount();
    }
  });

  it("shows the option matching the sort already in effect", () => {
    renderWithProviders(<SortBySelect />, {
      preloadedState: seed({ sortBy: "artist", sortOrder: "asc" }),
    });

    expect(screen.getByRole("combobox")).toHaveTextContent("Artist (A-Z)");
  });
});
