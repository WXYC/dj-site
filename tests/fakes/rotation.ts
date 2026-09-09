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
 */
export function fakeRotationEndpoints<Row extends FakeRotationRow>(
  initial: Row[],
  { buildRow }: { buildRow: (rotationBin: string) => Row },
) {
  let rows = [...initial];
  const nextRotationId = (current: Row[]) =>
    current.reduce((max, row) => Math.max(max, row.rotation_id), 0) + 1;
  const received: {
    add?: unknown;
    kills: { rotation_id: number; kill_date?: string }[];
  } = { kills: [] };
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
      const built = buildRow(body.rotation_bin);
      // The backend assigns a fresh rotation_id per add; `buildRow` callers
      // return a fixed one, which would collide with an already-active row
      // and let a single kill drop both.
      const newRow = rows.some((row) => row.rotation_id === built.rotation_id)
        ? { ...built, rotation_id: nextRotationId(rows) }
        : built;
      rows = [...rows, newRow];
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
      return HttpResponse.json({
        id: body.rotation_id,
        album_id: killed?.id ?? null,
        rotation_bin: killed?.rotation_bin ?? null,
        add_date: killed?.rotation_add_date ?? null,
        kill_date: body.kill_date ?? "2026-08-05",
      });
    }),
  );

  return {
    addBody: () => received.add,
    killBodies: () => received.kills,
    listRequests: () => listRequests,
  };
}

/**
 * Same GET/PATCH shape as `fakeRotationEndpoints`, but each PATCH resolves
 * only once the test releases it -- lets a test assert on in-flight state
 * instead of racing a same-tick MSW response. Gated per `rotation_id` so two
 * kills issued back-to-back can be released independently; `releaseKill()`
 * with no argument releases every outstanding kill at once.
 */
export function fakeRotationEndpointsWithGatedKill<Row extends FakeRotationRow>(
  initial: Row[],
) {
  let rows = [...initial];
  const pendingResolvers = new Map<number, () => void>();

  server.use(
    http.get(`${BACKEND_URL}/library/rotation`, () => HttpResponse.json(rows)),
    http.patch(`${BACKEND_URL}/library/rotation`, async ({ request }) => {
      const body = (await request.json()) as { rotation_id: number };
      await new Promise<void>((resolve) => {
        pendingResolvers.set(body.rotation_id, resolve);
      });
      const killed = rows.find((row) => row.rotation_id === body.rotation_id);
      rows = rows.filter((row) => row.rotation_id !== body.rotation_id);
      return HttpResponse.json({
        id: body.rotation_id,
        album_id: killed?.id ?? null,
        rotation_bin: killed?.rotation_bin ?? null,
        add_date: killed?.rotation_add_date ?? null,
        kill_date: "2026-08-05",
      });
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
