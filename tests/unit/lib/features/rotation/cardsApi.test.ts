import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { rotationApi } from "@/lib/features/rotation/api";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { describeApi } from "@/tests/helpers/api-harness";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

function rotationStore() {
  return configureStore({
    reducer: { [rotationApi.reducerPath]: rotationApi.reducer },
    middleware: (gdm) => gdm().concat(rotationApi.middleware),
  });
}

const BASE = `${TEST_BACKEND_URL}/library/rotation/cards`;

const HEAVY_2 = { id: 3, bin: "H", number: 2, name: "Heavy 2" };

describe("rotationApi — rotation card CRUD", () => {
  describeApi(rotationApi, {
    queries: ["getRotationCards"],
    mutations: ["addRotationCard", "updateRotationCard", "deleteRotationCard"],
    reducerPath: "rotationApi",
  });

  it("GETs /library/rotation/cards", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(BASE, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json([HEAVY_2]);
      }),
    );

    const store = rotationStore();
    const result = await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());

    expect(requested?.pathname).toBe("/library/rotation/cards");
    expect(result.data).toEqual([HEAVY_2]);
  });

  it("POSTs a new card and invalidates the cached list", async () => {
    let requestBody: unknown;
    server.use(
      http.get(BASE, () => HttpResponse.json([])),
      http.post(BASE, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(HEAVY_2, { status: 201 });
      }),
    );

    const store = rotationStore();
    await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
    const result = await store.dispatch(
      rotationApi.endpoints.addRotationCard.initiate({ bin: "H", name: "Heavy 2" }),
    );

    expect(requestBody).toEqual({ bin: "H", name: "Heavy 2" });
    expect(result.data).toEqual(HEAVY_2);
    expect(
      rotationApi.util.selectInvalidatedBy(store.getState(), [{ type: "RotationCards" }]),
    ).toEqual([expect.objectContaining({ endpointName: "getRotationCards" })]);
  });

  it("PATCHes /library/rotation/cards/:id with the id out of the body", async () => {
    let requestBody: unknown;
    let requested: URL | undefined;
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        requested = new URL(request.url);
        requestBody = await request.json();
        return HttpResponse.json({ ...HEAVY_2, name: "Heavy Two" });
      }),
    );

    const store = rotationStore();
    const result = await store.dispatch(
      rotationApi.endpoints.updateRotationCard.initiate({ id: 3, name: "Heavy Two" }),
    );

    expect(requested?.pathname).toBe("/library/rotation/cards/3");
    expect(requestBody).toEqual({ name: "Heavy Two" });
    expect(result.data).toMatchObject({ name: "Heavy Two" });
  });

  describe("row actions against the cached status=all list", () => {
    const ROTATION_BASE = `${TEST_BACKEND_URL}/library/rotation`;

    // A linked row of the management list read. Its `rotation_kill_date` and
    // `card` are the rotation row's own fields — the two the writes below
    // are allowed to patch in place.
    const STEREOLAB_ROW = {
      id: 9001,
      code_letters: "SL",
      code_artist_number: 1,
      code_number: 3,
      artist_name: "Stereolab",
      alphabetical_name: "Stereolab",
      album_title: "Instant Holograms on Metal Film",
      record_label: "Duophonic",
      label_id: null,
      genre_name: "Rock",
      format_name: "CD",
      rotation_id: 5001,
      add_date: "2026-09-01",
      rotation_add_date: "2026-09-01",
      rotation_bin: "H",
      rotation_kill_date: null,
      plays: null,
      legacy_release_id: null,
      card: null,
    };

    // The `status=all` read is the station's whole rotation history, so the
    // per-row writes (kill, unkill, card move) must move its rows by cache
    // patch, never by refetching it. Those same writes still refetch the
    // cards read — a card move relands the row on a different card, and a
    // kill-date change adds or drops the row from its card's active count,
    // both of which move the per-card counts the cards surface reports. A
    // plain snapshot edit crosses neither wall in the wrong direction; any
    // reach beyond these is a regression these counters exist to catch.
    function installCountingHandlers() {
      const counts = { cards: 0, list: 0 };
      let requested: URL | undefined;
      let requestBody: unknown;
      server.use(
        http.get(BASE, () => {
          counts.cards += 1;
          return HttpResponse.json([HEAVY_2]);
        }),
        http.get(ROTATION_BASE, () => {
          counts.list += 1;
          return HttpResponse.json([STEREOLAB_ROW]);
        }),
        // The bodyless-path kill (`PATCH /library/rotation`): the server
        // stamps the date itself and answers with the updated row.
        http.patch(ROTATION_BASE, async ({ request }) => {
          await request.json();
          return HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-09-01",
            kill_date: "2026-09-12",
          });
        }),
        http.patch(`${ROTATION_BASE}/:id`, async ({ request }) => {
          requested = new URL(request.url);
          const body = (await request.json()) as Record<string, unknown>;
          requestBody = body;
          return HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-09-01",
            kill_date: "kill_date" in body ? body.kill_date : null,
          });
        }),
      );
      return { counts, requested: () => requested, requestBody: () => requestBody };
    }

    const cachedAllList = (store: ReturnType<typeof rotationStore>) =>
      rotationApi.endpoints.getRotationList.select("all")(store.getState()).data;

    it("PATCHes {card_id} alone to /library/rotation/:id, refetches the cards read, and patches the cached row's card without a list refetch", async () => {
      const handlers = installCountingHandlers();
      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));

      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, card_id: 3 }),
      );

      expect(handlers.requested()?.pathname).toBe("/library/rotation/5001");
      expect(handlers.requestBody()).toEqual({ card_id: 3 });
      await vi.waitFor(() => {
        expect(handlers.counts.cards).toBe(2);
        expect(cachedAllList(store)).toEqual([{ ...STEREOLAB_ROW, card: HEAVY_2 }]);
      });
      expect(handlers.counts.list).toBe(1);
    });

    // A kill-date write is patched into the `status=all` read like a card
    // move — the presentation split derives from the date, so the row changes
    // sections without a full-history refetch — but it still crosses to the
    // cards side: the row leaves or rejoins its card's active count. So the
    // cards read refetches while the list stays patched. This pins the
    // `card_id OR kill_date` invalidation predicate: `kill_date` alone, with
    // no `card_id`, must still reach the cards tag.
    it("a kill-date edit refetches the cards read but patches the cached status=all row", async () => {
      const handlers = installCountingHandlers();
      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));

      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({
          rotation_id: 5001,
          kill_date: "2026-09-20",
        }),
      );

      await vi.waitFor(() => {
        expect(handlers.counts.cards).toBe(2);
        expect(cachedAllList(store)).toEqual([
          { ...STEREOLAB_ROW, rotation_kill_date: "2026-09-20" },
        ]);
      });
      // The list stays patched, never refetched, across the kill-date write.
      expect(handlers.counts.list).toBe(1);
    });

    // AC2 for the admin list: a row changes presentation through the
    // endpoints' cache patches, so the unbounded status=all read is fetched
    // exactly once across the whole kill-then-unkill sequence.
    it("kill then unkill moves the cached row by patch: exactly one list GET", async () => {
      const handlers = installCountingHandlers();
      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));

      await store.dispatch(rotationApi.endpoints.killRotationEntry.initiate({ rotation_id: 5001 }));
      await vi.waitFor(() =>
        expect(cachedAllList(store)).toEqual([
          { ...STEREOLAB_ROW, rotation_kill_date: "2026-09-12" },
        ]),
      );

      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({ rotation_id: 5001, kill_date: null }),
      );
      await vi.waitFor(() => expect(cachedAllList(store)).toEqual([STEREOLAB_ROW]));

      expect(handlers.counts.list).toBe(1);
    });

    // The snapshot columns of a linked list row belong to the library join,
    // not to the rotation row the write edited, so a snapshot edit cannot be
    // patched in place — it re-serves the list instead. And it carries
    // neither `card_id` nor `kill_date`, so it must not reach the cards read
    // a mounted cards surface holds.
    it("a snapshot edit re-serves the status=all list and leaves the cards read alone", async () => {
      const handlers = installCountingHandlers();
      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));

      await store.dispatch(
        rotationApi.endpoints.updateRotationRow.initiate({
          rotation_id: 5001,
          album_title: "Dots and Loops",
        }),
      );

      await vi.waitFor(() => expect(handlers.counts.list).toBe(2));
      expect(handlers.counts.cards).toBe(1);
    });
  });

  describe("membership writes and the cards read", () => {
    // The counts the cards GET carries change with every membership write —
    // an add lands a row on the target bin's newest card, a kill retires one
    // — so all three mutations must refetch the cards read a mounted cards
    // surface holds.
    type Store = ReturnType<typeof rotationStore>;
    it.each<[string, (store: Store) => Promise<unknown>]>([
      [
        "addRotationEntry",
        (store) =>
          store.dispatch(
            rotationApi.endpoints.addRotationEntry.initiate({ album_id: 9001, rotation_bin: "H" }),
          ),
      ],
      [
        "addFreeTextRotationEntry",
        (store) =>
          store.dispatch(
            rotationApi.endpoints.addFreeTextRotationEntry.initiate({
              rotation_bin: "M",
              artist_name: "Chuquimamani-Condori",
              album_title: "Edits",
            }),
          ),
      ],
      [
        "killRotationEntry",
        (store) =>
          store.dispatch(rotationApi.endpoints.killRotationEntry.initiate({ rotation_id: 5001 })),
      ],
    ])("%s refetches the cards read", async (_name, dispatchWrite) => {
      let cardsRequests = 0;
      server.use(
        http.get(BASE, () => {
          cardsRequests += 1;
          return HttpResponse.json([HEAVY_2]);
        }),
        http.post(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json(
            { id: 6001, album_id: null, rotation_bin: "H", add_date: "2026-09-13", kill_date: null },
            { status: 201 },
          ),
        ),
        http.patch(`${TEST_BACKEND_URL}/library/rotation`, () =>
          HttpResponse.json({
            id: 5001,
            album_id: null,
            rotation_bin: "H",
            add_date: "2026-09-01",
            kill_date: "2026-09-13",
          }),
        ),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
      expect(cardsRequests).toBe(1);

      await dispatchWrite(store);

      await vi.waitFor(() => expect(cardsRequests).toBe(2));
    });
  });

  describe("card CRUD and the rotation lists", () => {
    // The tag wall's reverse direction. Four membership mutations now list
    // both tags, which makes "add the Rotation tag here too" an easy future
    // mistake on the card CRUD's own writes — and a card add or rename that
    // refetched every rotation list is exactly the coupling the two-registry
    // split exists to prevent. A card write changes no album's membership,
    // so a mounted rotation list must sit out all three.
    type Store = ReturnType<typeof rotationStore>;
    it.each<[string, (store: Store) => Promise<unknown>]>([
      [
        "addRotationCard",
        (store) => store.dispatch(rotationApi.endpoints.addRotationCard.initiate({ bin: "H" })),
      ],
      [
        "updateRotationCard",
        (store) =>
          store.dispatch(rotationApi.endpoints.updateRotationCard.initiate({ id: 3, name: "Two" })),
      ],
      [
        "deleteRotationCard",
        (store) => store.dispatch(rotationApi.endpoints.deleteRotationCard.initiate(3)),
      ],
    ])("%s leaves a mounted rotation list unrefetched", async (_name, dispatchWrite) => {
      const counts = { cards: 0, list: 0 };
      server.use(
        http.get(BASE, () => {
          counts.cards += 1;
          return HttpResponse.json([HEAVY_2]);
        }),
        http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
          counts.list += 1;
          return HttpResponse.json([]);
        }),
        http.post(BASE, () => HttpResponse.json(HEAVY_2, { status: 201 })),
        http.patch(`${BASE}/:id`, () => HttpResponse.json({ ...HEAVY_2, name: "Two" })),
        http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })),
      );

      const store = rotationStore();
      await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
      await store.dispatch(rotationApi.endpoints.getRotationList.initiate("all"));

      await dispatchWrite(store);

      // The cards read refetching first proves the invalidation cycle ran to
      // completion before the list count is judged — a same-tick assertion
      // could pass while a wrong refetch was still scheduled.
      await vi.waitFor(() => expect(counts.cards).toBe(2));
      expect(counts.list).toBe(1);
    });
  });

  it("DELETEs /library/rotation/cards/:id", async () => {
    let requested: URL | undefined;
    let method: string | undefined;
    server.use(
      http.delete(`${BASE}/:id`, ({ request }) => {
        requested = new URL(request.url);
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const store = rotationStore();
    await store.dispatch(rotationApi.endpoints.deleteRotationCard.initiate(3));

    expect(requested?.pathname).toBe("/library/rotation/cards/3");
    expect(method).toBe("DELETE");
  });
});
