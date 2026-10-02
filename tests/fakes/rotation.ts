import { http, HttpResponse } from "msw";
import { server } from "./server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../helpers/constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A count a spec can await: `reached(n)` resolves once `bump()` has run `n`
 * times, at once if it already has. The gates below are built on it rather
 * than on a polling wait, so this module imports no testing library and the
 * node tier can load it.
 */
function awaitableCount() {
  let count = 0;
  const waiters: { n: number; resolve: () => void }[] = [];
  return {
    bump: () => {
      count += 1;
      waiters.filter((waiter) => waiter.n <= count).forEach((waiter) => waiter.resolve());
    },
    reached: (n: number) =>
      new Promise<void>((resolve) => {
        if (count >= n) resolve();
        else waiters.push({ n, resolve });
      }),
  };
}

export type FakeRotationRow = {
  id: number;
  rotation_id: number;
  rotation_bin: string;
  [key: string]: unknown;
};

/** Builds the row a POST appends for a given bin; callers own the fixture shape. */
type BuildRow<Row extends FakeRotationRow> = (rotationBin: string) => Row;

/**
 * Stateful stand-in for `GET/POST/PATCH /library/rotation`. The list is the
 * source of truth an add appends to and a kill removes from, so a consuming
 * control's state has to travel back through the list exactly as it does in
 * production rather than being handed to it directly.
 *
 * `buildRow` constructs the row POST appends to the list for a given bin --
 * callers own their own fixture shape (album id, artist, format, ...), this
 * fake only owns the add/kill/list state machine.
 *
 * The PATCH arm mirrors the backend's `isISODate` gate, which rejects
 * anything that isn't `YYYY-MM-DD` -- a serialized JS `Date` included.
 *
 * A kill *removes* the row rather than stamping `kill_date` on it, so this fake
 * cannot reproduce the production read's retention of a future-dated kill (the
 * behavior the `kill_date`-omission comments in `rotation/api.ts` exist for).
 * Modelling that needs the GET arm to apply the backend's own
 * kill_date-in-the-future filter, not just a `kill_date` field: every consumer
 * here derives membership from the rows the list returns, so a retained row
 * would read as still active. Add the filter alongside the field if a spec ever
 * needs to exercise that path.
 */
export function fakeRotationEndpoints<Row extends FakeRotationRow>(
  initial: Row[],
  { buildRow }: { buildRow: BuildRow<Row> },
) {
  let rows = [...initial];
  const received: {
    add?: unknown;
    kills: { rotation_id: number; kill_date?: string }[];
    // One sequence across both writes: the add-before-kill order is a safety
    // property of the set gesture, and per-arm logs cannot express it.
    calls: ("add" | "kill")[];
  } = { kills: [], calls: [] };
  let listRequests = 0;

  server.use(
    http.get(`${BACKEND_URL}/library/rotation`, () => {
      listRequests += 1;
      return HttpResponse.json(rows);
    }),
    http.post(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as {
        album_id: number;
        rotation_bin: string;
      };
      received.add = body;
      received.calls.push("add");
      const [nextRows, newRow] = appendAddedRow(rows, buildRow, body);
      rows = nextRows;
      return HttpResponse.json(
        {
          id: newRow.rotation_id,
          album_id: body.album_id,
          rotation_bin: body.rotation_bin,
          add_date: newRow.rotation_add_date ?? "2026-08-05",
          kill_date: null,
        },
        { status: 201 },
      );
    }),
    http.patch(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as {
        rotation_id: number;
        kill_date?: string;
      };
      received.kills.push(body);
      received.calls.push("kill");
      if (body.kill_date !== undefined && !ISO_DATE.test(body.kill_date)) {
        return HttpResponse.json(
          {
            error:
              "Bad Request, Incorrect Date Format: kill_date should be of form YYYY-MM-DD",
          },
          { status: 400 },
        );
      }
      const killed = rows.find((row) => row.rotation_id === body.rotation_id);
      rows = rows.filter((row) => row.rotation_id !== body.rotation_id);
      return HttpResponse.json(killedRotationResponse(body.rotation_id, killed, body.kill_date));
    }),
  );

  return {
    addBody: () => received.add,
    killBodies: () => received.kills,
    /** Every write this fake saw, in the order it saw them. */
    callOrder: () => [...received.calls],
    listRequests: () => listRequests,
  };
}

/**
 * Same GET/POST/PATCH shape as `fakeRotationEndpoints`, but each PATCH resolves
 * only once the test releases it -- lets a test assert on in-flight state
 * instead of racing a same-tick MSW response. Gated per `rotation_id` so two
 * kills issued back-to-back can be released independently; `releaseKill()`
 * with no argument releases every outstanding kill at once.
 *
 * The POST arm is not optional scaffolding: the set gesture always adds before
 * retiring, so a spec that drives a *set* through this fake reaches POST first
 * and would otherwise fail on an unhandled request rather than on the state it
 * is asserting.
 */
export function fakeRotationEndpointsWithGatedKill<Row extends FakeRotationRow>(
  initial: Row[],
  { buildRow }: { buildRow: BuildRow<Row> },
) {
  let rows = [...initial];
  const pendingResolvers = new Map<number, () => void>();

  server.use(
    http.get(`${BACKEND_URL}/library/rotation`, () => HttpResponse.json(rows)),
    http.post(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as {
        album_id: number;
        rotation_bin: string;
      };
      const [nextRows, newRow] = appendAddedRow(rows, buildRow, body);
      rows = nextRows;
      return HttpResponse.json(
        {
          id: newRow.rotation_id,
          album_id: body.album_id,
          rotation_bin: body.rotation_bin,
          add_date: newRow.rotation_add_date ?? "2026-08-05",
          kill_date: null,
        },
        { status: 201 },
      );
    }),
    http.patch(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as { rotation_id: number };
      await new Promise<void>((resolve) => {
        pendingResolvers.set(body.rotation_id, resolve);
      });
      const killed = rows.find((row) => row.rotation_id === body.rotation_id);
      rows = rows.filter((row) => row.rotation_id !== body.rotation_id);
      return HttpResponse.json(killedRotationResponse(body.rotation_id, killed));
    }),
  );

  return {
    releaseKill: (rotationId?: number) => {
      if (rotationId === undefined) {
        pendingResolvers.forEach((resolve) => resolve());
        pendingResolvers.clear();
        return;
      }
      pendingResolvers.get(rotationId)?.();
      pendingResolvers.delete(rotationId);
    },
  };
}

export type FakeRotationCard = {
  id: number;
  bin: string;
  number: number;
  name?: string | null;
  /**
   * The cards GET's active-row count. `fakeRotationCardsEndpoints` defaults
   * it to 0 when omitted; `fakeRotationAdminEndpoints` derives it from its
   * own rows instead and ignores whatever is set here, since that fake's
   * whole point is a count that follows a row's moves and kills.
   */
  active_count?: number;
};

// Not an extension of `FakeRotationRow`: that shape's `id` is a required
// number, and the admin list's whole point includes rows whose library link
// (`id`) is null.
export type FakeRotationAdminRow = {
  id: number | null;
  rotation_id: number;
  rotation_bin: string;
  rotation_kill_date: string | null;
  card?: FakeRotationCard | null;
  [key: string]: unknown;
};

/**
 * Stateful stand-in for the Rotation Admin list's whole surface: the
 * `status`-parameterized list read, the cards read, the add
 * (`POST /library/rotation` — both the catalogued and free-text arms, the
 * bin move's first half), the bodyless-path kill (`PATCH /library/rotation`)
 * and the field-level editor (`PATCH /library/rotation/:id` — unkill and
 * card moves).
 *
 * Unlike `fakeRotationEndpoints` above, a kill KEEPS the row and stamps
 * `rotation_kill_date` on it: the `status=all` read this fake feeds is
 * exactly the read that retains killed rows, so removal here would make the
 * consumer's Killed presentation untestable. The GET arm filters by the
 * `status` it's asked for, with the server's own predicates: `active` is no
 * kill date or one after `today`, `killed` is any kill date, and anything
 * else, including `all`, is every row. The two facets overlap rather than
 * partition -- a kill scheduled for a later day is in both, and still counts
 * toward its card's `active_count` -- while a kill dated `today` is already
 * out of `active`. A spec that asks for the wrong facet gets that facet's
 * rows, not the whole fixture passing as a smaller one.
 *
 * `today` is the server's `CURRENT_DATE` as `YYYY-MM-DD`. The database
 * session runs in UTC, so it defaults to the current UTC day; a spec whose
 * fixture dates are fixed passes its own so the outcome does not depend on
 * when it runs.
 *
 * The POST arm appends a row the list read then serves: a catalogued add
 * (`album_id`) copies the library-join fields from an existing row with that
 * `id`, a free-text add carries the snapshot from its own body, and either
 * lands on the target bin's newest card (highest number, id-desc tie-break)
 * when `card_id` is omitted — mirroring the server's own defaulting so a
 * consumer relying on it sees where the row actually lands.
 *
 * The single-row read (`GET /library/rotation/:id`) answers with the
 * row-summary shape. Its `format_id`/`label_id` come from the `rowSummaries`
 * option (keyed by rotation_id), never from the list row: on the wire those
 * are the rotation row's OWN pre-catalog fields, while the list row's
 * `label_id` is the library join's — serving one for the other would bake
 * the exact conflation the two reads' referent rule forbids into the fake.
 *
 * `gateCardMoves` holds every `PATCH /library/rotation/:id` until the caller
 * releases it with `releaseCardMoveOnceRequested`, and `failCardMove` refuses
 * named ids once released -- the card-assignment batch save's own gate, so a
 * spec exercising it never needs a second overlay handler that would shadow
 * this fake's own PATCH arm and silently stop `updateBodies()` recording.
 * Off by default: every other consumer of this fake expects an immediate
 * PATCH response.
 *
 * `holdActiveListReads` does the same for the `status=active` list read, the
 * one a batch save refetches when it settles: from that call on, each such
 * read waits for `releaseActiveListReads`, so a spec can look at what a
 * consumer shows between a save's last write and that refetch landing.
 * Reads of any other status are never held.
 *
 * Both releases return plain promises and wait on nothing but the request
 * itself. A spec rendering React awaits them inside `act`.
 */
export function fakeRotationAdminEndpoints(
  initialRows: FakeRotationAdminRow[],
  cards: FakeRotationCard[],
  {
    killDate = "2026-09-12",
    addDate = "2026-09-13",
    today = new Date().toISOString().slice(0, 10),
    rowSummaries = {},
    gateCardMoves = false,
  }: {
    killDate?: string;
    addDate?: string;
    today?: string;
    rowSummaries?: Record<number, { format_id?: number | null; label_id?: number | null }>;
    gateCardMoves?: boolean;
  } = {},
) {
  const rows = initialRows.map((row) => ({ ...row }));
  const listStatuses: (string | null)[] = [];
  let cardsRequests = 0;
  const addBodies: unknown[] = [];
  const killBodies: unknown[] = [];
  const updates: { id: number; body: Record<string, unknown> }[] = [];
  const cardMoveResolvers = new Map<number, () => void>();
  const cardMoveRequests = new Map<number, ReturnType<typeof awaitableCount>>();
  const cardMoveReleased = new Map<number, number>();
  let holdingActiveList = false;
  const heldActiveListReads: (() => void)[] = [];
  const activeListHolds = awaitableCount();
  let activeListHoldsReleased = 0;
  const cardMoveRefusals = new Map<number, number>();
  // One sequence across the two write arms: add-before-kill is the bin
  // move's safety property, and per-arm logs cannot express it.
  const calls: ("add" | "kill")[] = [];

  // Plain string comparison: two zero-padded ISO dates order as calendar days.
  const isActive = (row: FakeRotationAdminRow) =>
    row.rotation_kill_date == null || row.rotation_kill_date > today;

  const requestsFor = (id: number) => {
    const requests = cardMoveRequests.get(id) ?? awaitableCount();
    cardMoveRequests.set(id, requests);
    return requests;
  };

  const newestCard = (bin: string) =>
    cards
      .filter((card) => card.bin === bin)
      .sort((left, right) => right.number - left.number || right.id - left.id)[0] ?? null;

  server.use(
    http.get(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const status = new URL(request.url).searchParams.get("status");
      listStatuses.push(status);
      if (status === "active" && holdingActiveList) {
        // Held before the rows are read, so the answer is the list as it
        // stands at the release.
        await new Promise<void>((resolve) => {
          heldActiveListReads.push(resolve);
          activeListHolds.bump();
        });
      }
      const filtered =
        status === "active"
          ? rows.filter(isActive)
          : status === "killed"
            ? rows.filter((row) => row.rotation_kill_date != null)
            : rows;
      return HttpResponse.json(filtered);
    }),
    http.post(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as {
        album_id?: number;
        rotation_bin: string;
        artist_name?: string;
        album_title?: string;
        record_label?: string;
        urls?: string[];
      };
      addBodies.push(body);
      calls.push("add");
      const rotationId = rows.reduce((max, row) => Math.max(max, row.rotation_id), 0) + 1;
      const source = body.album_id != null ? rows.find((row) => row.id === body.album_id) : undefined;
      rows.push({
        ...source,
        id: body.album_id ?? null,
        rotation_id: rotationId,
        rotation_bin: body.rotation_bin,
        rotation_add_date: addDate,
        rotation_kill_date: null,
        artist_name: body.artist_name ?? source?.artist_name ?? null,
        album_title: body.album_title ?? source?.album_title ?? null,
        record_label: body.record_label ?? source?.record_label ?? null,
        // Never inherited from the source spread: the server stores what the
        // request carried, and a fixture-leaked copy would let a consumer
        // that dropped `urls` from its add keep passing a rendered-link
        // assertion.
        urls: body.urls,
        card: newestCard(body.rotation_bin),
      });
      return HttpResponse.json(
        {
          id: rotationId,
          album_id: body.album_id ?? null,
          rotation_bin: body.rotation_bin,
          add_date: addDate,
          kill_date: null,
        },
        { status: 201 },
      );
    }),
    http.get(`${BACKEND_URL}/library/rotation/cards`, () => {
      cardsRequests += 1;
      // Derived from the rows, not a fixed default: the card-assignment
      // batch save moves rows onto a card by PATCHing them in place, and a
      // fixed count here would make "the count follows the move" untestable.
      return HttpResponse.json(
        cards.map((card) => ({
          ...card,
          active_count: rows.filter((row) => row.card?.id === card.id && isActive(row)).length,
        })),
      );
    }),
    // Registered after the /cards arm: `:id` would otherwise swallow it.
    http.get(`${BACKEND_URL}/library/rotation/:id`, ({ params }) => {
      const id = Number(params.id);
      const row = rows.find((candidate) => candidate.rotation_id === id);
      if (!row) {
        return HttpResponse.json({ message: "Rotation entry not found" }, { status: 404 });
      }
      const summary = rowSummaries[id] ?? {};
      // The row-summary shape: `id` is the rotation row's own, `album_id`
      // the library link, and format_id/label_id the pre-catalog fields —
      // see the factory comment on `rowSummaries`.
      return HttpResponse.json({
        id,
        album_id: row.id,
        rotation_bin: row.rotation_bin,
        add_date: row.rotation_add_date ?? "2026-09-01",
        kill_date: row.rotation_kill_date,
        artist_name: row.artist_name ?? null,
        album_title: row.album_title ?? null,
        record_label: row.record_label ?? null,
        format_id: summary.format_id ?? null,
        label_id: summary.label_id ?? null,
      });
    }),
    http.patch(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as { rotation_id: number };
      killBodies.push(body);
      calls.push("kill");
      const row = rows.find((candidate) => candidate.rotation_id === body.rotation_id);
      if (row) row.rotation_kill_date = killDate;
      return HttpResponse.json({
        id: body.rotation_id,
        album_id: row?.id ?? null,
        rotation_bin: row?.rotation_bin ?? null,
        add_date: row?.rotation_add_date ?? null,
        kill_date: killDate,
      });
    }),
    http.patch(`${BACKEND_URL}/library/rotation/:id`, async ({ request, params }) => {
      const id = Number(params.id);
      const body = (await request.json()) as Record<string, unknown>;
      updates.push({ id, body });
      // The resolver is registered before the request is announced, so a
      // release woken by the announcement always finds this request's own.
      const held = gateCardMoves
        ? new Promise<void>((resolve) => cardMoveResolvers.set(id, resolve))
        : undefined;
      requestsFor(id).bump();
      await held;
      const refusedStatus = cardMoveRefusals.get(id);
      if (refusedStatus !== undefined) {
        return HttpResponse.json({ message: "refused" }, { status: refusedStatus });
      }
      const row = rows.find((candidate) => candidate.rotation_id === id);
      if (row) {
        if ("kill_date" in body) row.rotation_kill_date = body.kill_date as string | null;
        if ("card_id" in body) {
          row.card = cards.find((card) => card.id === body.card_id) ?? row.card;
        }
      }
      // The field editor answers with the row-summary shape, whose `id` is
      // the rotation row's own and whose `album_id` is the library link.
      return HttpResponse.json({
        id,
        album_id: row?.id ?? null,
        rotation_bin: row?.rotation_bin ?? null,
        add_date: row?.rotation_add_date ?? "2026-09-01",
        kill_date: row?.rotation_kill_date ?? null,
        artist_name: row?.artist_name ?? null,
        album_title: row?.album_title ?? null,
        record_label: row?.record_label ?? null,
      });
    }),
  );

  return {
    /** The `status` query param of every list GET, in order. */
    listStatuses: () => [...listStatuses],
    cardsRequests: () => cardsRequests,
    addBodies: () => [...addBodies],
    killBodies: () => [...killBodies],
    updateBodies: () => updates.map((update) => ({ id: update.id, body: { ...update.body } })),
    /** Every add/kill write this fake saw, in the order it saw them. */
    callOrder: () => [...calls],
    /**
     * Releases the next held `PATCH /:id` for `id` -- its nth request, where
     * n - 1 have been released already -- waiting until that request has
     * been made. Counted per id rather than taking whichever resolver is
     * registered: a retry re-requests an id an earlier save already sent,
     * and releasing on that earlier request would call a resolver that had
     * already settled and leave the retry's own request held for good.
     */
    releaseCardMoveOnceRequested: async (id: number) => {
      const nth = (cardMoveReleased.get(id) ?? 0) + 1;
      await requestsFor(id).reached(nth);
      cardMoveReleased.set(id, nth);
      cardMoveResolvers.get(id)?.();
    },
    failCardMove: (ids: number[], status = 500) => {
      cardMoveRefusals.clear();
      ids.forEach((id) => cardMoveRefusals.set(id, status));
    },
    /** Holds every `status=active` list read made from here on. */
    holdActiveListReads: () => {
      holdingActiveList = true;
    },
    /**
     * Stops holding and lets every held `status=active` read through,
     * waiting first until one this call has not already released is held.
     */
    releaseActiveListReads: async () => {
      await activeListHolds.reached(activeListHoldsReleased + 1);
      holdingActiveList = false;
      activeListHoldsReleased += heldActiveListReads.length;
      heldActiveListReads.splice(0).forEach((release) => release());
    },
  };
}

/**
 * Stateful stand-in for the cards CRUD surface
 * (`GET/POST /library/rotation/cards`, `PATCH/DELETE /library/rotation/cards/:id`).
 * The POST arm mirrors the server's own assignment — `number` is the bin's
 * max + 1, never read from the request — so a consumer that computed a
 * number locally would be caught disagreeing with the list the GET serves.
 *
 * DELETE here always succeeds: the consumer's disable rule is what's under
 * test, and the guard 409 is a race outcome a spec produces by overlaying
 * its own DELETE handler (`server.use` after installing this fake wins).
 */
export function fakeRotationCardsEndpoints(initialCards: FakeRotationCard[]) {
  let cards = initialCards.map((card) => ({ active_count: 0, ...card }));
  let listRequests = 0;
  const addBodies: unknown[] = [];
  const renames: { id: number; body: unknown }[] = [];
  const deletes: number[] = [];

  server.use(
    http.get(`${BACKEND_URL}/library/rotation/cards`, () => {
      listRequests += 1;
      return HttpResponse.json(cards);
    }),
    http.post(`${BACKEND_URL}/library/rotation/cards`, async ({ request }) => {
      const body = (await request.json()) as { bin: string; name?: string };
      addBodies.push(body);
      const nextNumber =
        cards.filter((card) => card.bin === body.bin).reduce((max, card) => Math.max(max, card.number), 0) + 1;
      const created = {
        id: cards.reduce((max, card) => Math.max(max, card.id), 0) + 1,
        bin: body.bin,
        number: nextNumber,
        name: body.name ?? null,
      };
      cards = [...cards, { ...created, active_count: 0 }];
      return HttpResponse.json(created);
    }),
    http.patch(`${BACKEND_URL}/library/rotation/cards/:id`, async ({ request, params }) => {
      const id = Number(params.id);
      const body = (await request.json()) as { name: string | null };
      renames.push({ id, body });
      const card = cards.find((candidate) => candidate.id === id);
      if (!card) return HttpResponse.json({ message: "Rotation card not found" }, { status: 404 });
      card.name = body.name;
      // The published card shape, without the list row's `active_count`.
      return HttpResponse.json({ id: card.id, bin: card.bin, number: card.number, name: card.name });
    }),
    http.delete(`${BACKEND_URL}/library/rotation/cards/:id`, ({ params }) => {
      const id = Number(params.id);
      deletes.push(id);
      cards = cards.filter((card) => card.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    listRequests: () => listRequests,
    addBodies: () => [...addBodies],
    renameBodies: () => renames.map((rename) => ({ id: rename.id, body: rename.body })),
    deletedIds: () => [...deletes],
  };
}

function appendAddedRow<Row extends FakeRotationRow>(
  rows: Row[],
  buildRow: BuildRow<Row>,
  body: { rotation_bin: string },
): [Row[], Row] {
  const built = buildRow(body.rotation_bin);
  // The backend assigns a fresh rotation_id per add; `buildRow` callers
  // return a fixed one, which would collide with an already-active row
  // and let a single kill drop both.
  const newRow = rows.some((row) => row.rotation_id === built.rotation_id)
    ? { ...built, rotation_id: nextRotationId(rows) }
    : built;
  return [[...rows, newRow], newRow];
}

const nextRotationId = (current: FakeRotationRow[]) =>
  current.reduce((max, row) => Math.max(max, row.rotation_id), 0) + 1;

function killedRotationResponse(
  rotationId: number,
  killed: FakeRotationRow | undefined,
  killDate?: string,
) {
  return {
    id: rotationId,
    album_id: killed?.id ?? null,
    rotation_bin: killed?.rotation_bin ?? null,
    add_date: killed?.rotation_add_date ?? null,
    kill_date: killDate ?? "2026-08-05",
  };
}
