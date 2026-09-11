import { http, HttpResponse } from "msw";
import { server } from "./server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../helpers/constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
