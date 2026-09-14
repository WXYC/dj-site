import { describe, expect, it, vi, afterEach } from "vitest";
import { patchCatalogSearchRotation } from "@/lib/features/catalog/patchSearchCaches";
import { catalogApi } from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { createTestAlbum } from "@/tests/fixtures/fixtures";
import type { AlbumEntry } from "@/lib/features/catalog/types";

describe("patchCatalogSearchRotation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates rotation fields on cached search rows", () => {
    const dispatch = vi.fn();
    const queryArgs = { q: "artist:Test" };
    const album = createTestAlbum({ id: 900 });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      queryArgs,
    ]);

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, args, updater) => {
        expect(args).toEqual(queryArgs);
        const draft = {
          pages: [
            {
              results: [album],
              total: 1,
              page: 0,
              totalPages: 1,
            },
          ],
        };
        updater(draft);
        expect(draft.pages[0].results[0].rotation_bin).toBe("H");
        expect(draft.pages[0].results[0].rotation_id).toBe(12);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(dispatch, () => ({} as never), 900, {
      rotation_bin: "H",
      rotation_id: 12,
    });

    expect(dispatch).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      catalogSlice.actions.setAlbumRotation({
        albumId: 900,
        rotation_bin: "H",
        rotation_id: 12,
      }),
    );
  });

  it("inserts the album when rotation filter matches and row was absent", () => {
    const dispatch = vi.fn();
    const queryArgs = { rotation_bins: "H" };
    const album = createTestAlbum({
      id: 42,
      rotation_bin: "H",
      rotation_id: 99,
      title: "New Heavy LP",
    });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      queryArgs,
    ]);

    vi.spyOn(catalogApi.endpoints.getInformation, "select").mockReturnValue(
      (() => () => undefined) as unknown as ReturnType<
        typeof catalogApi.endpoints.getInformation.select
      >,
    );

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, args, updater) => {
        expect(args).toEqual(queryArgs);
        const draft = {
          pages: [
            {
              results: [createTestAlbum({ id: 1, rotation_bin: "H" })],
              total: 1,
              page: 0,
              totalPages: 1,
            },
          ],
        };
        updater(draft);
        expect(draft.pages[0].results).toHaveLength(2);
        expect(draft.pages[0].results[0].id).toBe(42);
        expect(draft.pages[0].results[0].rotation_bin).toBe("H");
        expect(draft.pages[0].total).toBe(2);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(
      dispatch,
      () => ({} as never),
      42,
      { rotation_bin: "H", rotation_id: 99 },
      album,
    );
  });

  it("carries both ids through the inserted row", () => {
    // The insert path spreads a whole row and overrides only the two rotation
    // fields, so `id` and `legacy_release_id` ride along together. Pinned
    // because a row inserted with one id space and not the other resolves in
    // whichever space the reader happens to pick.
    const dispatch = vi.fn();
    const album = createTestAlbum({
      id: 42,
      legacy_release_id: 45042,
      rotation_bin: "H",
      rotation_id: 99,
    });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      { rotation_bins: "H" },
    ]);

    vi.spyOn(catalogApi.endpoints.getInformation, "select").mockReturnValue(
      (() => () => undefined) as unknown as ReturnType<
        typeof catalogApi.endpoints.getInformation.select
      >,
    );

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, _args, updater) => {
        const draft = {
          pages: [
            { results: [] as AlbumEntry[], total: 0, page: 0, totalPages: 1 },
          ],
        };
        updater(draft);
        expect(draft.pages[0].results[0].id).toBe(42);
        expect(draft.pages[0].results[0].legacy_release_id).toBe(45042);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(
      dispatch,
      () => ({} as never),
      42,
      { rotation_bin: "H", rotation_id: 99 },
      album,
    );
  });

  it("sets the card on the cached row when the patch names one", () => {
    const dispatch = vi.fn();
    const card = { id: 3, bin: "H" as const, number: 2, name: "Heavy 2" };
    const album = createTestAlbum({ id: 900 });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([{}]);
    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, _args, updater) => {
        const draft = { pages: [{ results: [album], total: 1, page: 0, totalPages: 1 }] };
        updater(draft);
        expect(draft.pages[0].results[0].card).toEqual(card);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(dispatch, () => ({} as never), 900, {
      rotation_bin: "H",
      rotation_id: 12,
      card,
    });
  });

  it("clears the card when the patch explicitly names null", () => {
    const dispatch = vi.fn();
    const album = createTestAlbum({
      id: 900,
      card: { id: 3, bin: "H" as const, number: 2, name: "Heavy 2" },
    });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([{}]);
    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, _args, updater) => {
        const draft = { pages: [{ results: [album], total: 1, page: 0, totalPages: 1 }] };
        updater(draft);
        expect(draft.pages[0].results[0].card).toBeNull();
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(dispatch, () => ({} as never), 900, {
      rotation_bin: undefined,
      rotation_id: undefined,
      card: null,
    });
  });

  it("leaves the cached card untouched on the resolved-album path when the patch omits it", () => {
    // Distinct from the fallback-branch test below: here getInformation's
    // cache resolves the album, and that resolved row has no card -- exactly
    // what a server response yields for a row whose card only ever arrived
    // via an optimistic patch. Copying the resolved row's (absent) card over
    // the draft would wipe the value the omitted key exists to protect.
    const dispatch = vi.fn();
    const card = { id: 3, bin: "H" as const, number: 2, name: "Heavy 2" };
    const cachedRow = createTestAlbum({ id: 900, card });
    const resolved = createTestAlbum({ id: 900 });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([{}]);
    vi.spyOn(catalogApi.endpoints.getInformation, "select").mockReturnValue(
      (() => ({ data: resolved })) as unknown as ReturnType<
        typeof catalogApi.endpoints.getInformation.select
      >,
    );
    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, _args, updater) => {
        const draft = { pages: [{ results: [cachedRow], total: 1, page: 0, totalPages: 1 }] };
        updater(draft);
        expect(draft.pages[0].results[0].rotation_bin).toBe("H");
        expect(draft.pages[0].results[0].rotation_id).toBe(12);
        expect(draft.pages[0].results[0].card).toEqual(card);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(dispatch, () => ({} as never), 900, {
      rotation_bin: "H",
      rotation_id: 12,
    });
  });

  it("leaves an existing cached card untouched when the patch omits it", () => {
    const dispatch = vi.fn();
    const card = { id: 3, bin: "H" as const, number: 2, name: "Heavy 2" };
    const album = createTestAlbum({ id: 900, card });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([{}]);
    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, _args, updater) => {
        const draft = { pages: [{ results: [album], total: 1, page: 0, totalPages: 1 }] };
        updater(draft);
        // Field-level rotation edits (e.g. an Unkill) never change the card,
        // so the caller omits the key entirely rather than naming a value.
        expect(draft.pages[0].results[0].card).toEqual(card);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(dispatch, () => ({} as never), 900, {
      rotation_bin: "H",
      rotation_id: 12,
    });
  });
});
