import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { createTestDeletedArchiveBatch } from "@/tests/fixtures/fixtures";
import { catalogApi } from "@/lib/features/catalog/api";
import {
  interpretRestoreError,
  RESTORE_RESOLUTION_REQUIRED_MESSAGE,
} from "@/lib/features/catalog/restoreDeletedBatchOutcome";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const BATCH_ID = "8f14e45f-ceea-4c31-b8a3-000000000001";
const RESTORE_URL = `${TEST_BACKEND_URL}/library/deleted/${BATCH_ID}/restore`;
const ARCHIVE_URL = `${TEST_BACKEND_URL}/library/deleted`;
const SEARCH_URL = `${TEST_BACKEND_URL}/library/`;
const ARTIST_RELEASES_URL = `${TEST_BACKEND_URL}/library/artists/4211/releases`;

/**
 * Counts every read a restore can make stale, so the assertions name WHICH
 * lists the write invalidates rather than only that it invalidates something.
 * A restore re-files a release onto a shelf slot, which is what makes the two
 * catalog lists wrong; the archive listing itself is unchanged by the write and
 * is re-read rather than corrected.
 */
function countingReads() {
  const calls = { archive: 0, search: 0, artistReleases: 0 };
  server.use(
    http.get(ARCHIVE_URL, () => {
      calls.archive += 1;
      return HttpResponse.json({
        results: [createTestDeletedArchiveBatch({ batch_id: BATCH_ID })],
        total: 1,
        page: 0,
        totalPages: 1,
      });
    }),
    http.get(SEARCH_URL, () => {
      calls.search += 1;
      return HttpResponse.json([]);
    }),
    http.get(ARTIST_RELEASES_URL, () => {
      calls.artistReleases += 1;
      return HttpResponse.json({ releases: [], total: 0, page: 1, totalPages: 1 });
    }),
  );
  return calls;
}

async function subscribeAll(store: ReturnType<typeof createTestStore>) {
  const subs = [
    store.dispatch(catalogApi.endpoints.listDeletedArchive.initiate({})),
    store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Autechre",
        album_title: undefined,
        n: undefined,
      }),
    ),
    store.dispatch(catalogApi.endpoints.getArtistReleases.initiate({ artistId: 4211 })),
  ];
  await Promise.all(subs);
  return () => subs.forEach((sub) => sub.unsubscribe());
}

describe("restoreDeletedBatch", () => {
  it("POSTs to the batch's own restore path with no resolution", async () => {
    let method: string | undefined;
    let body: string | undefined;
    server.use(
      http.post(RESTORE_URL, async ({ request }) => {
        method = request.method;
        body = await request.text();
        return HttpResponse.json({ batch_id: BATCH_ID });
      }),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.restoreDeletedBatch.initiate({ batchId: BATCH_ID }),
    );

    expect(method).toBe("POST");
    // This screen has no resolution UI, so a taken call-code slot must come
    // back as a refusal to read rather than as a slot the client silently chose.
    expect(body).toBeFalsy();
    expect("error" in result && result.error).toBeFalsy();
  });

  it("hands a resolution_required refusal to the interpreter in the shape it expects", async () => {
    server.use(
      http.post(RESTORE_URL, () =>
        HttpResponse.json(
          {
            message:
              "Cannot restore without a decision: the call code is held by another release. Re-send with resolution=next_free_code or resolution=decline.",
            reason: "resolution_required",
            conflicts: [],
          },
          { status: 400 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.restoreDeletedBatch.initiate({ batchId: BATCH_ID }),
    );
    const error = "error" in result ? result.error : undefined;

    // The wrapper and the interpreter are one contract, and interpreting off a
    // live dispatch is the part a unit test of the interpreter alone cannot do:
    // `transformErrorResponse` sits between the body and the reason, so a
    // rename on either side of it leaves both halves individually green.
    expect(error).toHaveProperty("restoreDeletedBatchError");
    expect(error).not.toHaveProperty("data");
    expect(interpretRestoreError(error)).toEqual({
      reason: "resolution_required",
      message: RESTORE_RESOLUTION_REQUIRED_MESSAGE,
      retryable: false,
    });
  });

  it("brings the re-filed release back into every list that describes where it sits", async () => {
    const calls = countingReads();
    server.use(http.post(RESTORE_URL, () => HttpResponse.json({ batch_id: BATCH_ID })));

    const store = createTestStore();
    const unsubscribe = await subscribeAll(store);
    expect(calls).toEqual({ archive: 1, search: 1, artistReleases: 1 });

    await store.dispatch(catalogApi.endpoints.restoreDeletedBatch.initiate({ batchId: BATCH_ID }));

    // A catalog search cached before the restore is missing a row that is back
    // on the shelf, and the artist's release table is both wrong about the
    // shelf and the source the next call number is derived from — leaving it
    // stale files a second card into the slot the restore just re-occupied.
    await vi.waitFor(() => expect(calls.search).toBe(2));
    await vi.waitFor(() => expect(calls.artistReleases).toBe(2));
    // The archive row itself is unchanged by a restore; it is re-read so the
    // page is not held across a write to the catalog it describes.
    await vi.waitFor(() => expect(calls.archive).toBe(2));
    unsubscribe();
  });

  it("leaves cached lists alone when the restore was refused", async () => {
    const calls = countingReads();
    server.use(
      http.post(RESTORE_URL, () =>
        HttpResponse.json(
          {
            message: "Cannot restore: this batch is already back in the catalog (library ids: 53375)",
            reason: "already_restored",
            entity_ids: [53375],
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const unsubscribe = await subscribeAll(store);

    await store.dispatch(catalogApi.endpoints.restoreDeletedBatch.initiate({ batchId: BATCH_ID }));
    // A real delay, not a microtask: an invalidation-driven refetch is
    // dispatched asynchronously, so asserting on the next tick would pass
    // whether or not one was queued.
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The server answered below 500, so it reached a handler that declined
    // before writing. Refetching three lists to reconfirm that is pure cost.
    expect(calls).toEqual({ archive: 1, search: 1, artistReleases: 1 });
    unsubscribe();
  });

  it("still refreshes the lists when no answer came back", async () => {
    const calls = countingReads();
    server.use(http.post(RESTORE_URL, () => HttpResponse.error()));

    const store = createTestStore();
    const unsubscribe = await subscribeAll(store);

    await store.dispatch(catalogApi.endpoints.restoreDeletedBatch.initiate({ batchId: BATCH_ID }));

    // The restore may well have committed on a response that never arrived.
    // Treating a lost answer like a refusal leaves every cached list asserting
    // a release that is back on the shelf is still deleted.
    await vi.waitFor(() => expect(calls.search).toBe(2));
    await vi.waitFor(() => expect(calls.artistReleases).toBe(2));
    unsubscribe();
  });
});
