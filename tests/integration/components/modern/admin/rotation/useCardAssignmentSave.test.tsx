import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";
import { createTestStore, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { rotationApi } from "@/lib/features/rotation/api";
import type { MoveRowsOntoCardOutcome } from "@/lib/features/rotation/moveRowsOntoCard";
import type { AppStore } from "@/lib/store";
import { useCardAssignmentSave } from "@/src/components/experiences/modern/admin/rotation/useCardAssignmentSave";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const CARD_ID = 3;
const OTHER_CARD_ID = 4;

type SaveResult = Promise<MoveRowsOntoCardOutcome | null>;

function wrapper(store: AppStore): (props: PropsWithChildren) => ReactElement {
  return ({ children }) => <Provider store={store}>{children}</Provider>;
}

// Both states that did not move are `ok: false`, so "not ok" cannot tell a
// refused row from one that was never sent. These name each state whole, and
// are compared with `toEqual`: a row reported in the other state fails.
const refusal = (status: number) => ({
  rotationWriteError: expect.objectContaining({ status }),
});
const failedWith = (status: number) => ({ ok: false, error: refusal(status) });
const NOT_ATTEMPTED = { ok: false, notAttempted: true };

function row(id: number) {
  return { id, album_id: null, rotation_bin: "H", add_date: "2026-09-01", kill_date: null };
}

/**
 * Gates every `PATCH /library/rotation/:id` until the test releases it, so
 * the assertions below can catch the loop mid-batch instead of racing a
 * same-tick MSW response -- the same shape as `fakeRotationEndpointsWithGatedKill`.
 */
function installGatedCardMoveHandler() {
  const resolvers = new Map<number, () => void>();
  const released = new Map<number, number>();
  const failing = new Map<number, number>();
  const bodies: { id: number; body: unknown }[] = [];

  server.use(
    http.patch(`${TEST_BACKEND_URL}/library/rotation/:id`, async ({ request, params }) => {
      const id = Number(params.id);
      bodies.push({ id, body: await request.json() });
      await new Promise<void>((resolve) => resolvers.set(id, resolve));
      const refusal = failing.get(id);
      if (refusal !== undefined) {
        return HttpResponse.json({ message: "refused" }, { status: refusal });
      }
      return HttpResponse.json(row(id));
    }),
  );

  return {
    // Rows move one at a time, so the loop issues its next PATCH only once
    // the current one resolves -- waiting for the request to land before
    // releasing it is what keeps these releases from racing the loop. The
    // wait counts this id's requests rather than looking for one: a retry
    // re-requests an id an earlier save already sent, and releasing on the
    // earlier request would call a resolver that has already settled and
    // leave the retry's own request gated for good.
    releaseOnceRequested: async (id: number) => {
      const nth = (released.get(id) ?? 0) + 1;
      await waitFor(() => expect(bodies.filter((call) => call.id === id)).toHaveLength(nth));
      released.set(id, nth);
      resolvers.get(id)?.();
    },
    failFor: (ids: number[], status = 500) => {
      failing.clear();
      ids.forEach((id) => failing.set(id, status));
    },
    bodies: () => [...bodies],
  };
}

/**
 * Counts the three reads a save can owe a refetch: the cards read, the
 * bounded `status=active` facet (`activeList`) and the unbounded
 * `status=all` read (`list`). The cards read serves the destination card:
 * a move onto a card missing from that cache re-serves `status=all` per
 * row, which would drown the per-batch counts these specs judge.
 */
function installReadCounters() {
  const counts = { cards: 0, list: 0, activeList: 0 };
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () => {
      counts.cards += 1;
      return HttpResponse.json([{ id: CARD_ID, bin: "H", number: 3, name: null, active_count: 0 }]);
    }),
    http.get(`${TEST_BACKEND_URL}/library/rotation`, ({ request }) => {
      if (new URL(request.url).searchParams.get("status") === "active") counts.activeList += 1;
      else counts.list += 1;
      return HttpResponse.json([]);
    }),
  );
  return counts;
}

async function storeHoldingEveryRead() {
  const store = createTestStore();
  await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
  await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));
  await store.dispatch(rotationApi.endpoints.getRotationList.initiate("active"));
  return store;
}

// Resolves once every read the store has in flight has landed. The batch's
// refetch is started before `running` drops, so a count read after this
// cannot pass while a refetch is still on its way.
const settleReads = (store: AppStore) =>
  Promise.all(store.dispatch(rotationApi.util.getRunningQueriesThunk()));

function renderSaveHook(store: AppStore = createTestStore()) {
  return renderHook(({ cardId }) => useCardAssignmentSave(cardId), {
    wrapper: wrapper(store),
    initialProps: { cardId: CARD_ID },
  });
}

describe("useCardAssignmentSave", () => {
  it("advances progress one record at a time to N of N", async () => {
    const handler = installGatedCardMoveHandler();
    const { result } = renderSaveHook();

    act(() => {
      void result.current.save([900, 901, 902]);
    });

    await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 3 }));
    await handler.releaseOnceRequested(900);
    await waitFor(() => expect(result.current.progress).toEqual({ done: 1, total: 3 }));
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.progress).toEqual({ done: 2, total: 3 }));
    await handler.releaseOnceRequested(902);
    await waitFor(() => expect(result.current.progress).toEqual({ done: 3, total: 3 }));
    await waitFor(() => expect(result.current.running).toBe(false));
  });

  it("PATCHes each row with the hook's card as card_id", async () => {
    const handler = installGatedCardMoveHandler();
    const { result } = renderSaveHook();

    act(() => {
      void result.current.save([900, 901]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(handler.bodies()).toEqual([
      { id: 900, body: { card_id: CARD_ID } },
      { id: 901, body: { card_id: CARD_ID } },
    ]);
  });

  it("reports a failing row as failed and the rest as moved, and resolves to that outcome", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901]);
    const { result } = renderSaveHook();

    let saved!: SaveResult;
    act(() => {
      saved = result.current.save([900, 901, 902]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await handler.releaseOnceRequested(902);

    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.results.get(900)).toEqual({ ok: true });
    expect(result.current.results.get(901)).toEqual(failedWith(500));
    expect(result.current.results.get(902)).toEqual({ ok: true });
    await expect(saved).resolves.toEqual({
      moved: [900, 902],
      failed: [{ rotationId: 901, error: refusal(500) }],
      notAttempted: [],
    });
  });

  it("retry resends only the failed row", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901]);
    const { result } = renderSaveHook();

    act(() => {
      void result.current.save([900, 901]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.results.get(901)).toEqual(failedWith(500));

    // The retried row now goes through: a librarian who retries after fixing
    // whatever the server refused for expects the resend to actually land.
    handler.failFor([]);
    let retried!: SaveResult;
    act(() => {
      retried = result.current.retry();
    });
    await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 1 }));
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(handler.bodies().map((call) => call.id)).toEqual([900, 901, 901]);
    expect(result.current.progress).toEqual({ done: 1, total: 1 });
    expect(result.current.results.get(900)).toEqual({ ok: true });
    expect(result.current.results.get(901)).toEqual({ ok: true });
    await expect(retried).resolves.toEqual({ moved: [901], failed: [], notAttempted: [] });
  });

  it("retries two failed rows where only one lands, keeping the row that already landed", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901, 902]);
    const { result } = renderSaveHook();

    act(() => {
      void result.current.save([900, 901, 902]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await handler.releaseOnceRequested(902);
    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.results.get(900)).toEqual({ ok: true });
    expect(result.current.results.get(901)).toEqual(failedWith(500));
    expect(result.current.results.get(902)).toEqual(failedWith(500));

    // 901 now goes through; 902 is refused again, with a different status,
    // so the error it ends up carrying can only be the retry's.
    handler.failFor([902], 409);
    let retried!: SaveResult;
    act(() => {
      retried = result.current.retry();
    });
    await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 2 }));
    await handler.releaseOnceRequested(901);
    await handler.releaseOnceRequested(902);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(result.current.results.get(900)).toEqual({ ok: true });
    expect(result.current.results.get(901)).toEqual({ ok: true });
    expect(result.current.results.get(902)).toEqual(failedWith(409));
    await expect(retried).resolves.toEqual({
      moved: [901],
      failed: [{ rotationId: 902, error: refusal(409) }],
      notAttempted: [],
    });

    // A second retry sends only the row still failed.
    handler.failFor([]);
    act(() => {
      void result.current.retry();
    });
    await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 1 }));
    await handler.releaseOnceRequested(902);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(handler.bodies().map((call) => call.id)).toEqual([900, 901, 902, 901, 902, 902]);
    expect(result.current.results.get(902)).toEqual({ ok: true });
  });

  it("starts each save from an empty result list, where a retry keeps the rows that landed", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901]);
    const { result } = renderSaveHook();

    act(() => {
      void result.current.save([900, 901]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));

    act(() => {
      void result.current.save([902]);
    });
    await handler.releaseOnceRequested(902);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect([...result.current.results]).toEqual([[902, { ok: true }]]);
    expect(result.current.progress).toEqual({ done: 1, total: 1 });
  });

  // The `status=all` read is the station's whole rotation history. A batch
  // that landed whole has already patched every row in it, so only the cards
  // read and the bounded list facet are owed a refetch -- once per save.
  it("refetches the cards read and the list facet once per save, and never the status=all read, when every row moves", async () => {
    const handler = installGatedCardMoveHandler();
    const counts = installReadCounters();
    const store = await storeHoldingEveryRead();
    expect(counts).toEqual({ cards: 1, list: 1, activeList: 1 });
    const { result } = renderSaveHook(store);

    act(() => {
      void result.current.save([900, 901, 902]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await handler.releaseOnceRequested(902);

    await waitFor(() => expect(result.current.running).toBe(false));
    await settleReads(store);
    expect(counts).toEqual({ cards: 2, list: 1, activeList: 2 });
  });

  // A refused PATCH can have committed with its response lost. Nothing
  // patches the `status=all` read for a rejected row, so a batch with any
  // failure re-serves it rather than leaving it on the old card.
  it("also re-serves the status=all read, once, when a row fails", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901]);
    const counts = installReadCounters();
    const store = await storeHoldingEveryRead();
    const { result } = renderSaveHook(store);

    act(() => {
      void result.current.save([900, 901, 902]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await handler.releaseOnceRequested(902);

    await waitFor(() => expect(result.current.running).toBe(false));
    await settleReads(store);
    expect(counts).toEqual({ cards: 2, list: 2, activeList: 2 });
  });

  it("ignores a save or a retry called while a run is in flight", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901]);
    const counts = installReadCounters();
    const store = await storeHoldingEveryRead();
    const { result } = renderSaveHook(store);

    act(() => {
      void result.current.save([900, 901]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));
    await settleReads(store);

    handler.failFor([]);
    let retried!: SaveResult;
    let secondSave!: SaveResult;
    let secondRetry!: SaveResult;
    act(() => {
      retried = result.current.retry();
    });
    await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 1 }));
    act(() => {
      secondSave = result.current.save([902, 903]);
      secondRetry = result.current.retry();
    });
    expect(result.current.progress).toEqual({ done: 0, total: 1 });
    expect(result.current.results.get(900)).toEqual({ ok: true });

    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));
    await settleReads(store);

    expect(handler.bodies().map((call) => call.id)).toEqual([900, 901, 901]);
    expect(result.current.progress).toEqual({ done: 1, total: 1 });
    expect(counts.cards).toBe(3);
    await expect(retried).resolves.toEqual({ moved: [901], failed: [], notAttempted: [] });
    await expect(secondSave).resolves.toBeNull();
    await expect(secondRetry).resolves.toBeNull();
  });

  // `inFlight` is a ref, not state: it is set before the first `await` inside
  // `save`, so a second call made synchronously in the same tick sees it
  // already true even though `running` has not yet re-rendered to reflect
  // the first call. A guard built on `running` alone would miss this.
  it("ignores a second save() made in the same tick as the first, before any re-render", async () => {
    const handler = installGatedCardMoveHandler();
    const { result } = renderSaveHook();

    let firstSave!: SaveResult;
    let secondSave!: SaveResult;
    act(() => {
      firstSave = result.current.save([900, 901]);
      secondSave = result.current.save([902, 903]);
    });

    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(handler.bodies().map((call) => call.id)).toEqual([900, 901]);
    await expect(firstSave).resolves.toEqual({ moved: [900, 901], failed: [], notAttempted: [] });
    await expect(secondSave).resolves.toBeNull();
  });

  it("does nothing for an empty save or a retry with nothing failed", async () => {
    const handler = installGatedCardMoveHandler();
    const counts = installReadCounters();
    const store = await storeHoldingEveryRead();
    const runningSeen: boolean[] = [];
    const { result } = renderHook(
      () => {
        const value = useCardAssignmentSave(CARD_ID);
        runningSeen.push(value.running);
        return value;
      },
      { wrapper: wrapper(store) },
    );

    act(() => {
      void result.current.save([900]);
    });
    await handler.releaseOnceRequested(900);
    await waitFor(() => expect(result.current.running).toBe(false));
    await settleReads(store);
    const countsAfterSave = { ...counts };
    runningSeen.length = 0;

    let emptySave: MoveRowsOntoCardOutcome | null = null;
    let emptyRetry: MoveRowsOntoCardOutcome | null = null;
    await act(async () => {
      emptySave = await result.current.save([]);
      emptyRetry = await result.current.retry();
    });
    await settleReads(store);

    expect(emptySave).toEqual({ moved: [], failed: [], notAttempted: [] });
    expect(emptyRetry).toEqual({ moved: [], failed: [], notAttempted: [] });
    expect(runningSeen).not.toContain(true);
    expect(result.current.progress).toEqual({ done: 1, total: 1 });
    expect(result.current.results.get(900)).toEqual({ ok: true });
    expect(handler.bodies().map((call) => call.id)).toEqual([900]);
    expect(counts).toEqual(countsAfterSave);
  });

  describe("when a batch stops after three consecutive failures", () => {
    it("reports the moved, failed and not-attempted rows, counts only attempted rows in progress, and retries the not-attempted rows and then the failed ones with the total reset", async () => {
      const handler = installGatedCardMoveHandler();
      handler.failFor([901, 902, 903]);
      const { result } = renderSaveHook();

      let saved!: SaveResult;
      act(() => {
        saved = result.current.save([900, 901, 902, 903, 904, 905]);
      });
      await handler.releaseOnceRequested(900);
      await handler.releaseOnceRequested(901);
      await handler.releaseOnceRequested(902);
      await handler.releaseOnceRequested(903);
      await waitFor(() => expect(result.current.running).toBe(false));

      expect(handler.bodies().map((call) => call.id)).toEqual([900, 901, 902, 903]);
      expect(result.current.progress).toEqual({ done: 4, total: 6 });
      expect(result.current.results.get(900)).toEqual({ ok: true });
      expect(result.current.results.get(901)).toEqual(failedWith(500));
      expect(result.current.results.get(902)).toEqual(failedWith(500));
      expect(result.current.results.get(903)).toEqual(failedWith(500));
      expect(result.current.results.get(904)).toEqual(NOT_ATTEMPTED);
      expect(result.current.results.get(905)).toEqual(NOT_ATTEMPTED);
      await expect(saved).resolves.toEqual({
        moved: [900],
        failed: [901, 902, 903].map((rotationId) => ({ rotationId, error: refusal(500) })),
        notAttempted: [904, 905],
      });

      handler.failFor([]);
      let retried!: SaveResult;
      act(() => {
        retried = result.current.retry();
      });
      await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 5 }));
      await handler.releaseOnceRequested(904);
      await handler.releaseOnceRequested(905);
      await handler.releaseOnceRequested(901);
      await handler.releaseOnceRequested(902);
      await handler.releaseOnceRequested(903);
      await waitFor(() => expect(result.current.running).toBe(false));

      expect(handler.bodies().map((call) => call.id)).toEqual([
        900, 901, 902, 903, 904, 905, 901, 902, 903,
      ]);
      expect(result.current.progress).toEqual({ done: 5, total: 5 });
      for (const id of [900, 901, 902, 903, 904, 905]) {
        expect(result.current.results.get(id)).toEqual({ ok: true });
      }
      await expect(retried).resolves.toEqual({
        moved: [904, 905, 901, 902, 903],
        failed: [],
        notAttempted: [],
      });
    });

    // Rows the server refuses every time would, resent in their original
    // order, stop every retry before it reached anything behind them.
    it("does not let three rows refused on every attempt starve the rows behind them: one retry lands every other row", async () => {
      const handler = installGatedCardMoveHandler();
      handler.failFor([900, 901, 902]);
      const { result } = renderSaveHook();

      act(() => {
        void result.current.save([900, 901, 902, 903, 904, 905]);
      });
      await handler.releaseOnceRequested(900);
      await handler.releaseOnceRequested(901);
      await handler.releaseOnceRequested(902);
      await waitFor(() => expect(result.current.running).toBe(false));
      expect(result.current.progress).toEqual({ done: 3, total: 6 });

      let retried!: SaveResult;
      act(() => {
        retried = result.current.retry();
      });
      await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 6 }));
      await handler.releaseOnceRequested(903);
      await handler.releaseOnceRequested(904);
      await handler.releaseOnceRequested(905);
      await handler.releaseOnceRequested(900);
      await handler.releaseOnceRequested(901);
      await handler.releaseOnceRequested(902);
      await waitFor(() => expect(result.current.running).toBe(false));

      expect(handler.bodies().map((call) => call.id)).toEqual([
        900, 901, 902, 903, 904, 905, 900, 901, 902,
      ]);
      for (const id of [903, 904, 905]) {
        expect(result.current.results.get(id)).toEqual({ ok: true });
      }
      for (const id of [900, 901, 902]) {
        expect(result.current.results.get(id)).toEqual(failedWith(500));
      }
      // The stop landed on the retry's last three rows, so it left nothing
      // unattempted.
      expect(result.current.progress).toEqual({ done: 6, total: 6 });
      await expect(retried).resolves.toEqual({
        moved: [903, 904, 905],
        failed: [900, 901, 902].map((rotationId) => ({ rotationId, error: refusal(500) })),
        notAttempted: [],
      });
    });

    // A retry can stop too. The rows it did not reach keep the state they
    // had: a row that failed earlier stays failed, with the refusal it got,
    // and only a row never sent at all is still not attempted. Were the
    // earlier failures demoted to not attempted, they would go back to the
    // head of the next retry and stop it ahead of the rows still unsent.
    it("keeps a stopped retry's unreached rows in the state they had, so the next retry still starts with the rows never sent", async () => {
      const handler = installGatedCardMoveHandler();
      handler.failFor([900, 901, 902]);
      const { result } = renderSaveHook();

      act(() => {
        void result.current.save([900, 901, 902, 903, 904, 905, 906, 907]);
      });
      await handler.releaseOnceRequested(900);
      await handler.releaseOnceRequested(901);
      await handler.releaseOnceRequested(902);
      await waitFor(() => expect(result.current.running).toBe(false));

      // The first retry's refusals carry a different status, so a row still
      // showing the save's status was not overwritten by the retry.
      handler.failFor([900, 901, 902, 903, 904, 905], 409);
      let retried!: SaveResult;
      act(() => {
        retried = result.current.retry();
      });
      await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 8 }));
      await handler.releaseOnceRequested(903);
      await handler.releaseOnceRequested(904);
      await handler.releaseOnceRequested(905);
      await waitFor(() => expect(result.current.running).toBe(false));

      expect(result.current.progress).toEqual({ done: 3, total: 8 });
      for (const id of [900, 901, 902]) {
        expect(result.current.results.get(id)).toEqual(failedWith(500));
      }
      for (const id of [903, 904, 905]) {
        expect(result.current.results.get(id)).toEqual(failedWith(409));
      }
      expect(result.current.results.get(906)).toEqual(NOT_ATTEMPTED);
      expect(result.current.results.get(907)).toEqual(NOT_ATTEMPTED);
      // The outcome describes this one run, in the order it was sent: every
      // row it did not reach, whatever happened to that row before.
      await expect(retried).resolves.toEqual({
        moved: [],
        failed: [903, 904, 905].map((rotationId) => ({ rotationId, error: refusal(409) })),
        notAttempted: [906, 907, 900, 901, 902],
      });

      act(() => {
        void result.current.retry();
      });
      await waitFor(() => expect(result.current.progress).toEqual({ done: 0, total: 8 }));
      await handler.releaseOnceRequested(906);
      await handler.releaseOnceRequested(907);
      await handler.releaseOnceRequested(900);
      await handler.releaseOnceRequested(901);
      await handler.releaseOnceRequested(902);
      await waitFor(() => expect(result.current.running).toBe(false));

      expect(handler.bodies().map((call) => call.id)).toEqual([
        900, 901, 902, 903, 904, 905, 906, 907, 900, 901, 902,
      ]);
      expect(result.current.results.get(906)).toEqual({ ok: true });
      expect(result.current.results.get(907)).toEqual({ ok: true });
      for (const id of [900, 901, 902, 903, 904, 905]) {
        expect(result.current.results.get(id)).toEqual(failedWith(409));
      }
    });
  });

  // The hook's owner can stay mounted while the card it is pointed at
  // changes. A save belongs to the card it was started against: its results
  // describe that card's rows, and a row that failed to reach it must never
  // be resent to whichever card happens to be open.
  describe("when the card changes under a mounted hook", () => {
    it("exposes a save's progress and results only while pointed at the card it was saved against", async () => {
      const handler = installGatedCardMoveHandler();
      handler.failFor([901]);
      const { result, rerender } = renderSaveHook();

      act(() => {
        void result.current.save([900, 901]);
      });
      await handler.releaseOnceRequested(900);
      await waitFor(() => expect(result.current.progress).toEqual({ done: 1, total: 2 }));

      rerender({ cardId: OTHER_CARD_ID });
      expect(result.current.running).toBe(true);
      expect(result.current.progress).toEqual({ done: 0, total: 0 });
      expect(result.current.results.size).toBe(0);

      await handler.releaseOnceRequested(901);
      await waitFor(() => expect(result.current.running).toBe(false));
      expect(result.current.progress).toEqual({ done: 0, total: 0 });
      expect(result.current.results.size).toBe(0);
      // Re-pointing mid-run does not redirect the rows still to be sent.
      expect(handler.bodies()).toEqual([
        { id: 900, body: { card_id: CARD_ID } },
        { id: 901, body: { card_id: CARD_ID } },
      ]);

      rerender({ cardId: CARD_ID });
      expect(result.current.progress).toEqual({ done: 2, total: 2 });
      expect(result.current.results.get(900)).toEqual({ ok: true });
      expect(result.current.results.get(901)).toEqual(failedWith(500));
    });

    // The two-row spec above re-points the hook while the batch's last row
    // is pending, so nothing is left to redirect. A third row that is still
    // to be sent after the re-point is what this one can catch going to the
    // wrong card.
    it("sends a row still pending after a mid-run card change to the card the save started against", async () => {
      const handler = installGatedCardMoveHandler();
      const { result, rerender } = renderSaveHook();

      act(() => {
        void result.current.save([900, 901, 902]);
      });
      await handler.releaseOnceRequested(900);
      await waitFor(() => expect(result.current.progress).toEqual({ done: 1, total: 3 }));

      rerender({ cardId: OTHER_CARD_ID });
      await handler.releaseOnceRequested(901);
      await handler.releaseOnceRequested(902);
      await waitFor(() => expect(result.current.running).toBe(false));

      rerender({ cardId: CARD_ID });
      expect(handler.bodies()).toEqual([
        { id: 900, body: { card_id: CARD_ID } },
        { id: 901, body: { card_id: CARD_ID } },
        { id: 902, body: { card_id: CARD_ID } },
      ]);
      expect(result.current.progress).toEqual({ done: 3, total: 3 });
    });

    it("retry never moves one card's failed rows onto another card", async () => {
      const handler = installGatedCardMoveHandler();
      handler.failFor([901]);
      const { result, rerender } = renderSaveHook();

      act(() => {
        void result.current.save([900, 901]);
      });
      await handler.releaseOnceRequested(900);
      await handler.releaseOnceRequested(901);
      await waitFor(() => expect(result.current.running).toBe(false));
      const retryFromSavedCard = result.current.retry;

      rerender({ cardId: OTHER_CARD_ID });
      let retriedOnOtherCard: MoveRowsOntoCardOutcome | null = null;
      await act(async () => {
        retriedOnOtherCard = await result.current.retry();
      });
      expect(retriedOnOtherCard).toEqual({ moved: [], failed: [], notAttempted: [] });
      expect(result.current.running).toBe(false);
      expect(handler.bodies().map((call) => call.id)).toEqual([900, 901]);

      // A `retry` captured while the hook was still on the saved card is the
      // one way the failed row can be resent from here, and it goes to the
      // card it was saved against, not the one now open.
      handler.failFor([]);
      act(() => {
        void retryFromSavedCard();
      });
      await handler.releaseOnceRequested(901);
      await waitFor(() => expect(result.current.running).toBe(false));

      expect(handler.bodies()).toEqual([
        { id: 900, body: { card_id: CARD_ID } },
        { id: 901, body: { card_id: CARD_ID } },
        { id: 901, body: { card_id: CARD_ID } },
      ]);
    });
  });
});
