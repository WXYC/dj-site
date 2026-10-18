import { describe, it, expect, expectTypeOf, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/tests/fixtures/fixtures";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { useGetAlbumReviewsByArtistQuery } from "@/lib/features/reviews/albumReviewApi";
import { useReviewProbablyExists } from "@/src/hooks/useReviewProbablyExists";

vi.mock("@/lib/features/catalog/api", () => ({ useSearchCatalogQuery: vi.fn() }));
vi.mock("@/lib/features/reviews/albumReviewApi", () => ({ useGetAlbumReviewsByArtistQuery: vi.fn() }));

const search = vi.mocked(useSearchCatalogQuery);
const forms = vi.mocked(useGetAlbumReviewsByArtistQuery);
const doga = createTestAlbum({ title: "DOGA", artist: createTestArtist({ name: "Juana Molina" }) });

// Only `currentData` is read: `data` would carry a previous argument's rows over.
const answer = (currentData: unknown, extra = {}) => ({ currentData, data: "stale", ...extra }) as never;

beforeEach(() => {
  search.mockReset().mockReturnValue(answer(undefined));
  forms.mockReset().mockReturnValue(answer(undefined));
});

describe("useReviewProbablyExists", () => {
  it.each([
    ["a blank artist", "  ", "DOGA", true],
    ["a blank album", "Juana Molina", "", true],
    ["a lookup turned off", "Juana Molina", "DOGA", false],
  ])("makes no request for %s", (_case, artist, album, enabled) => {
    const { result } = renderHook(() => useReviewProbablyExists(artist, album, enabled));

    expect(search).toHaveBeenLastCalledWith(expect.anything(), { skip: true });
    expect(forms).toHaveBeenLastCalledWith(expect.anything(), { skip: true });
    expect(result.current).toEqual({ library: undefined, formCount: 0, any: false });
  });

  it("searches the catalog by the trimmed artist and album, and the archive by the trimmed artist", () => {
    renderHook(() => useReviewProbablyExists(" Juana Molina ", " DOGA ", true));

    expect(search).toHaveBeenLastCalledWith({ artist_name: "Juana Molina", album_title: "DOGA", n: 20 }, { skip: false });
    expect(forms).toHaveBeenLastCalledWith("Juana Molina", { skip: false });
  });

  it("answers from the current argument's rows only", () => {
    search.mockReturnValue({ data: [doga], currentData: undefined } as never);
    forms.mockReturnValue({ data: [{}, {}], currentData: undefined } as never);

    const { result } = renderHook(() => useReviewProbablyExists("Juana Molina", "DOGA", true));

    expect(result.current.any).toBe(false);
  });

  it.each([
    ["no form reviews", [], 0],
    ["one form review", [{}], 1],
    ["three form reviews", [{}, {}, {}], 3],
  ])("counts %s", (_case, rows, formCount) => {
    forms.mockReturnValue(answer(rows));

    const { result } = renderHook(() => useReviewProbablyExists("Juana Molina", "DOGA", true));

    expect(result.current.formCount).toBe(formCount);
    expect(result.current.any).toBe(formCount > 0);
  });

  it("reports the matching library release", () => {
    search.mockReturnValue(answer([doga]));

    const { result } = renderHook(() => useReviewProbablyExists("juana molina", "doga", true));

    expect(result.current).toMatchObject({ library: doga, any: true });
  });

  it("types a library match's id as a number, so a caller can cite it without a check", () => {
    search.mockReturnValue(answer([doga]));

    const { result } = renderHook(() => useReviewProbablyExists("Juana Molina", "DOGA", true));

    expectTypeOf<NonNullable<typeof result.current.library>["id"]>().toEqualTypeOf<number>();
    expect(result.current.library?.id).toBe(doga.id);
  });

  it("shows no hint for a failed read, and still shows what the other read found", () => {
    search.mockReturnValue(answer(undefined, { isError: true }));
    forms.mockReturnValue(answer([{}]));

    const { result } = renderHook(() => useReviewProbablyExists("Juana Molina", "DOGA", true));

    expect(result.current).toEqual({ library: undefined, formCount: 1, any: true });
  });
});
