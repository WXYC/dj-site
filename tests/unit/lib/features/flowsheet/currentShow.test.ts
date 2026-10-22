import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import {
  CLOSED_SHOW_SENTENCE,
} from "@/lib/features/show-playlist/api";
import {
  REJECTED_PROGRAM_SENTENCE,
  showTagRefusal,
} from "@/lib/features/specialty/copy";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

const SPECIALTY = { id: 4, slug: "sunday-jazz", name: "Sunday Jazz", short_name: "Jazz", logs_playcuts: true };
const OLD_SHOW = { id: 90, start_time: "2026-10-18T16:00:00Z", specialty: null };
const OPEN_SHOW = { id: 91, start_time: "2026-10-19T16:00:00Z", specialty: SPECIALTY };

const page = (body: Record<string, unknown>) =>
  http.get(`${TEST_BACKEND_URL}/flowsheet`, () =>
    HttpResponse.json({ entries: [], page: 0, limit: 1, total: 0, total_pages: 0, ...body })
  );

describe("getCurrentShow", () => {
  it.each([
    ["the show matching on_air.show_id", { on_air: { dj_name: "DJ", show_id: 91 }, shows: [OLD_SHOW, OPEN_SHOW] }, OPEN_SHOW],
    ["null when nobody is on air", { on_air: null, shows: [OLD_SHOW] }, null],
    ["null when shows is absent", { on_air: { dj_name: "DJ", show_id: 91 } }, null],
    ["null when the open show is not listed", { on_air: { dj_name: "DJ", show_id: 92 }, shows: [OLD_SHOW] }, null],
  ])("reads %s", async (_name, body, expected) => {
    server.use(page(body));
    const result = await createTestStore().dispatch(
      flowsheetApi.endpoints.getCurrentShow.initiate()
    );
    expect(result.data ?? null).toEqual(expected);
  });

  it("is refetched after updateShow invalidates the Flowsheet tag", async () => {
    let specialty: typeof SPECIALTY | null = null;
    let patched: unknown;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet`, () =>
        HttpResponse.json({
          entries: [], page: 0, limit: 1, total: 0, total_pages: 0,
          on_air: { dj_name: "DJ", show_id: 91 },
          shows: [{ ...OPEN_SHOW, specialty }],
        })
      ),
      http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/91`, async ({ request }) => {
        patched = await request.json();
        specialty = SPECIALTY;
        return HttpResponse.json({ id: 91 });
      })
    );
    const store = createTestStore();
    const sub = store.dispatch(flowsheetApi.endpoints.getCurrentShow.initiate());
    expect((await sub).data?.specialty).toBeNull();

    await store.dispatch(
      flowsheetApi.endpoints.updateShow.initiate({ showId: 91, specialty_id: 4 })
    );

    expect(patched).toEqual({ specialty_id: 4 });
    await vi.waitFor(() =>
      expect(
        flowsheetApi.endpoints.getCurrentShow.select()(store.getState()).data?.specialty
      ).toEqual(SPECIALTY)
    );
    sub.unsubscribe();
  });
});

describe("updateShow refusals", () => {
  it.each([
    ["a 400", 400, { message: "Unknown program" }, REJECTED_PROGRAM_SENTENCE, true],
    ["a closed_show 403", 403, { code: "closed_show", message: "Show closed" }, CLOSED_SHOW_SENTENCE, true],
    ["a 403 without a code", 403, { error: "forbidden" }, null, false],
    ["a ban 403", 403, { message: "Banned", reason: "x" }, null, false],
    ["a 401", 401, { message: "Unauthorized" }, null, false],
  ])("%s", async (_name, status, body, sentence, expected) => {
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/91`, () =>
        HttpResponse.json(body, { status })
      )
    );
    const result = await createTestStore().dispatch(
      flowsheetApi.endpoints.updateShow.initiate({ showId: 91, show_name: "x" })
    );
    const error = result.error as { expected?: boolean; status: number; data: unknown };
    expect(showTagRefusal(error)).toBe(sentence);
    expect(error.expected === true).toBe(expected);
  });
});
