import { describe, it, expect } from "vitest";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { mergeAlbumIntoSearchResult } from "@/lib/features/catalog/patchSearchResult";

describe("mergeAlbumIntoSearchResult", () => {
  it("updates editable fields while preserving search-only metadata", () => {
    const existing = createTestAlbum({
      id: 42,
      title: "Old Title",
      label: "Old Label",
      entry: 3,
      plays: 12,
      matched_via: [{ source: "library_identity", title: "Old Title" }],
      artwork_url: "https://example.com/art.jpg",
      rotation_id: 99,
    });
    const updated = createTestAlbum({
      id: 42,
      title: "New Title",
      label: "New Label",
      entry: 99,
      plays: 0,
      matched_via: undefined,
      artwork_url: null,
      rotation_id: undefined,
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.title).toBe("New Title");
    expect(merged.label).toBe("New Label");
    // A nonzero entry from the response is the server's authoritative call
    // number and must win over the cached one — see the reattribution test
    // below for why.
    expect(merged.entry).toBe(99);
    expect(merged.plays).toBe(12);
    expect(merged.matched_via).toEqual(existing.matched_via);
    expect(merged.artwork_url).toBe("https://example.com/art.jpg");
    expect(merged.rotation_id).toBe(99);
  });

  it("carries the server's reissued call number when re-attribution changes it", () => {
    // updateAlbum can move an album onto a fresh call number when the newly
    // linked artist already owns the album's current one (Backend-Service
    // burns a new code_number). The cached search row must pick up both the
    // new entry number and the new artist prefix, or it renders a call
    // number that doesn't exist on the shelf.
    const existing = createTestAlbum({
      id: 42,
      entry: 3,
      artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 12 }),
    });
    const updated = createTestAlbum({
      id: 42,
      entry: 47,
      artist: createTestArtist({ name: "Jessica Pratt", lettercode: "PR", numbercode: 3 }),
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.entry).toBe(47);
    expect(merged.artist.lettercode).toBe("PR");
    expect(merged.artist.numbercode).toBe(3);
  });

  it("falls back to the cached entry when the response's code_number is the LML-only sentinel", () => {
    // `entry: 0` isn't a real call number — it's convertToAlbumEntry's
    // fallback for a row with no code_number at all — so it must not
    // overwrite a cached row that does have one. The call number's three
    // parts (lettercode, numbercode, entry) have to come from the same row:
    // pairing the response's artist prefix with the cached entry digit would
    // print a call number that belongs to neither row, so the fallback must
    // carry the cached artist along with the cached entry, not just the entry.
    const existing = createTestAlbum({
      id: 42,
      entry: 5,
      artist: createTestArtist({ name: "Jessica Pratt", lettercode: "PR", numbercode: 3 }),
    });
    const updated = createTestAlbum({
      id: 42,
      entry: 0,
      artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 12 }),
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.entry).toBe(5);
    expect(merged.artist.lettercode).toBe("PR");
    expect(merged.artist.numbercode).toBe(3);
  });

  it("clears date_lost and date_found when mutation returns null", () => {
    const existing = createTestAlbum({
      id: 42,
      date_lost: "2024-01-01",
      date_found: undefined,
    });
    const updated = createTestAlbum({
      id: 42,
      date_lost: null,
      date_found: "2024-02-01",
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.date_lost).toBeNull();
    expect(merged.date_found).toBe("2024-02-01");
  });

  it("applies a defined discogsUnavailable flag from the mutation response", () => {
    const existing = createTestAlbum({ id: 42, discogsUnavailable: false });
    const updated = createTestAlbum({ id: 42, discogsUnavailable: true });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.discogsUnavailable).toBe(true);
  });

  it("falls back to the cached discogsUnavailable flag when the response omits it", () => {
    const existing = createTestAlbum({ id: 42, discogsUnavailable: true });
    const updated = createTestAlbum({ id: 42, discogsUnavailable: undefined });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.discogsUnavailable).toBe(true);
  });

  it("passes through an explicit null discogsUnavailableNote (cleared on the server)", () => {
    const existing = createTestAlbum({
      id: 42,
      discogsUnavailable: true,
      discogsUnavailableNote: "embargoed until 2026-09-01",
    });
    const updated = createTestAlbum({
      id: 42,
      discogsUnavailable: false,
      discogsUnavailableNote: null,
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.discogsUnavailableNote).toBeNull();
  });

  it("falls back to the cached discogsUnavailableNote when the response omits it", () => {
    const existing = createTestAlbum({
      id: 42,
      discogsUnavailable: true,
      discogsUnavailableNote: "embargoed until 2026-09-01",
    });
    const updated = createTestAlbum({
      id: 42,
      discogsUnavailable: true,
      discogsUnavailableNote: undefined,
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.discogsUnavailableNote).toBe("embargoed until 2026-09-01");
  });

  it("merges albums with empty title fields from LML-only rows", () => {
    const existing = createTestAlbum({
      id: 42,
      title: "Old Title",
      genre_id: 1,
    });
    const updated = createTestAlbum({
      id: 42,
      title: "",
      label: "",
      entry: 0,
      artist: createTestArtist({ id: 5, name: "", lettercode: "AB", numbercode: 1 }),
      genre_id: 7,
      format_id: 3,
    });

    const merged = mergeAlbumIntoSearchResult(existing, updated);

    expect(merged.title).toBe("");
    expect(merged.genre_id).toBe(7);
    expect(merged.format_id).toBe(3);
  });
});
