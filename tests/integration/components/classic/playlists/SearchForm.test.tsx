import { describe, it, expect } from "vitest";
import { screen, act } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import SearchForm from "@/src/components/experiences/classic/playlists/SearchForm";

describe("Classic Previous Sets SearchForm", () => {
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
