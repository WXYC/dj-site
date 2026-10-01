import { describe, it, expect } from "vitest";
import { renderWithProviders, server } from "@/tests/helpers";
import { playlistSearchFake } from "@/tests/fakes/playlistSearch";
import { playlistSearchApi } from "@/lib/features/playlist-search/api";
import SearchBar from "@/src/components/experiences/modern/previous-sets/Search/SearchBar";

describe("SearchBar (modern previous sets)", () => {
  it("never requests /flowsheet/search on its own", async () => {
    const fake = playlistSearchFake({ archiveSize: 1 });
    server.use(fake.handler);

    const { store } = renderWithProviders(<SearchBar />);

    // A subscriber registers its cache entry while it mounts, before any
    // request leaves, so an empty query cache needs no wait to be conclusive.
    expect(store.getState()[playlistSearchApi.reducerPath].queries).toEqual({});

    // There is no "request landed" signal to await, because the point of the
    // assertion is that one never fires — so this gives RTK Query's mount
    // effect and MSW's interception a real tick to have dispatched it.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fake.requests).toHaveLength(0);
  });
});
