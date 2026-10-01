import { describe, it, expect } from "vitest";
import { screen, act } from "@testing-library/react";
import { renderWithProviders, server } from "@/tests/helpers";
import { playlistSearchFake } from "@/tests/fakes/playlistSearch";
import { playlistSearchApi } from "@/lib/features/playlist-search/api";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import SearchForm from "@/src/components/experiences/classic/playlists/SearchForm";

describe("Classic Previous Sets SearchForm", () => {
  it("never requests /flowsheet/search on its own", async () => {
    const fake = playlistSearchFake({ archiveSize: 1 });
    server.use(fake.handler);

    const { store } = renderWithProviders(<SearchForm />);

    // A subscriber registers its cache entry while it mounts, before any
    // request leaves, so an empty query cache needs no wait to be conclusive.
    expect(store.getState()[playlistSearchApi.reducerPath].queries).toEqual({});

    // There is no "request landed" signal to await, because the point of the
    // assertion is that one never fires — so this gives RTK Query's mount
    // effect and MSW's interception a real tick to have dispatched it.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fake.requests).toHaveLength(0);
  });

  it("renders a single free-form text input", () => {
    renderWithProviders(<SearchForm />);
    const input = screen.getByPlaceholderText(/type to search/i);
    expect(input).toBeDefined();
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).type).toBe("text");
  });

  it("updates the playlistSearch row when the user types", async () => {
    const { user, store } = renderWithProviders(<SearchForm />);
    const input = screen.getByPlaceholderText(/type to search/i);
    await user.type(input, "polvo");
    const rows = store.getState().playlistSearch.rows;
    expect(rows[0].value).toBe("polvo");
  });

  it("renders the value from the slice", () => {
    const { container, store } = renderWithProviders(<SearchForm />);
    const rowId = store.getState().playlistSearch.rows[0].id;
    act(() => {
      store.dispatch(
        playlistSearchSlice.actions.updateRow({
          id: rowId,
          updates: { value: "preloaded query" },
        })
      );
    });
    const input = container.querySelector(
      "input[type='text']"
    ) as HTMLInputElement;
    expect(input.value).toBe("preloaded query");
  });
});
