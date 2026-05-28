import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCatalogEntryForm } from "./useCatalogEntryForm";

describe("useCatalogEntryForm", () => {
  it("unlocks album section when existing artist is selected", () => {
    const { result } = renderHook(() => useCatalogEntryForm());

    act(() => {
      result.current.setGenreId("11");
      result.current.selectExistingArtist({
        id: 99,
        artist_name: "Built to Spill",
        code_letters: "BU",
        code_number: 60,
      });
    });

    expect(result.current.albumSectionUnlocked).toBe(true);
    expect(result.current.artistId).toBe(99);
    expect(result.current.showNewArtistFields).toBe(false);
    expect(result.current.codeFieldsLocked).toBe(true);
    expect(result.current.artistOption).toMatchObject({
      type: "existing",
      artist_name: "Built to Spill",
    });
  });

  it("requires create artist before album for new artist path", () => {
    const { result } = renderHook(() => useCatalogEntryForm());

    act(() => {
      result.current.setGenreId("11");
      result.current.selectNewArtist("Brand New Band");
    });

    expect(result.current.showNewArtistFields).toBe(true);
    expect(result.current.albumSectionUnlocked).toBe(false);
    expect(result.current.canCreateArtist).toBe(false);
    expect(result.current.artistOption).toBeNull();
    expect(result.current.newArtistName).toBe("Brand New Band");

    act(() => {
      result.current.setCodeLetters("BR");
      result.current.setCodeNumber("1");
    });

    expect(result.current.canCreateArtist).toBe(true);

    act(() => {
      result.current.markArtistCreated(42);
    });

    expect(result.current.albumSectionUnlocked).toBe(true);
    expect(result.current.artistId).toBe(42);
    expect(result.current.artistOption).toMatchObject({
      type: "existing",
      id: 42,
      artist_name: "Brand New Band",
      code_letters: "BR",
      code_number: 1,
    });
  });

  it("resets artist selection when input changes after commit", () => {
    const { result } = renderHook(() => useCatalogEntryForm());

    act(() => {
      result.current.setGenreId("11");
      result.current.selectExistingArtist({
        id: 1,
        artist_name: "Radiohead",
        code_letters: "RA",
        code_number: 5,
      });
    });

    expect(result.current.artistMode).toBe("existing");

    act(() => {
      result.current.handleArtistInputChange("Radioheadx");
    });

    expect(result.current.artistMode).toBe("idle");
    expect(result.current.artistId).toBeNull();
    expect(result.current.artistOption).toBeNull();
    expect(result.current.artistInputValue).toBe("Radioheadx");
  });

  it("resets artist when genre changes", () => {
    const { result } = renderHook(() => useCatalogEntryForm());

    act(() => {
      result.current.setGenreId("11");
      result.current.selectExistingArtist({
        id: 1,
        artist_name: "A",
        code_letters: "AA",
        code_number: 1,
      });
      result.current.setGenreId("12");
    });

    expect(result.current.artistMode).toBe("idle");
    expect(result.current.artistId).toBeNull();
  });
});
