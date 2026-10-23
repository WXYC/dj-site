import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import {
  CLOSED_SHOW_SENTENCE,
  NOT_ON_SHOW_SENTENCE,
  refusalSentence,
} from "@/lib/features/show-playlist/api";
import {
  ONE_TAP_TAG_REFUSED_SENTENCE,
  REJECTED_PROGRAM_SENTENCE,
  SHOW_DETAILS_REFUSED_SENTENCE,
} from "@/lib/features/specialty/copy";
import { whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
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
const OLD_SHOW = { id: 90, start_time: "2026-10-18T16:00:00Z", specialty: null, show_name: null };
const OPEN_SHOW = { id: 91, start_time: "2026-10-19T16:00:00Z", specialty: SPECIALTY, show_name: "Thursday Night Feature" };

const page = (body: Record<string, unknown>) =>
  http.get(`${TEST_BACKEND_URL}/flowsheet`, () =>
    HttpResponse.json({ entries: [], page: 0, limit: 1, total: 0, total_pages: 0, ...body })
  );

describe("getCurrentShow", () => {
  it.each([
    ["the show matching on_air.show_id", { on_air: { dj_name: "DJ", show_id: 91 }, shows: [OLD_SHOW, OPEN_SHOW] }, { ...OPEN_SHOW, spotlight_role: null }],
    [
      "the request line and spotlight role from on_air",
      {
        on_air: { dj_name: "DJ", show_id: 91, request_line: { mode: "closed", source: "spotlight" }, spotlight: { spotlight_role: "reader" } },
        shows: [OPEN_SHOW],
      },
      { ...OPEN_SHOW, request_line: { mode: "closed", source: "spotlight" }, spotlight_role: "reader" },
    ],
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

  it.each([
    ["present", { show_name: "Thursday Night Feature" }, "Thursday Night Feature"],
    ["null", { show_name: null }, null],
    ["absent", {}, null],
  ])("carries show_name when it is %s", async (_name, fields, expected) => {
    const { show_name: _omit, ...bare } = OPEN_SHOW;
    server.use(page({ on_air: { dj_name: "DJ", show_id: 91 }, shows: [{ ...bare, ...fields }] }));
    const result = await createTestStore().dispatch(
      flowsheetApi.endpoints.getCurrentShow.initiate()
    );
    expect(result.data?.show_name).toBe(expected);
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
    ["a 400 for a program tag", { specialty_id: 4 }, 400, { message: "Unknown program" }, REJECTED_PROGRAM_SENTENCE, true],
    ["a 400 for a cleared program tag", { specialty_id: null }, 400, { message: "x" }, REJECTED_PROGRAM_SENTENCE, true],
    ["a 400 for a title only", { show_name: "x" }, 400, { message: "Bad show_name" }, SHOW_DETAILS_REFUSED_SENTENCE, true],
    ["a closed_show 403", { show_name: "x" }, 403, { code: "closed_show", message: "Show closed" }, CLOSED_SHOW_SENTENCE, true],
    ["a 400 for a request mode", { request_mode: "closed" as const }, 400, { message: "Bad request_mode" }, SHOW_DETAILS_REFUSED_SENTENCE, true],
    ["a closed_show 403 for a request mode", { request_mode: null }, 403, { code: "closed_show" }, CLOSED_SHOW_SENTENCE, true],
    ["a 403 without a code", { show_name: "x" }, 403, { error: "forbidden" }, null, false],
    ["a ban 403", { show_name: "x" }, 403, { message: "Banned", reason: "x" }, null, false],
    ["a 401", { show_name: "x" }, 401, { message: "Unauthorized" }, null, false],
  ])("%s", async (_name, args, status, body, sentence, expected) => {
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/91`, () =>
        HttpResponse.json(body, { status })
      )
    );
    const result = await createTestStore().dispatch(
      flowsheetApi.endpoints.updateShow.initiate({ showId: 91, ...args })
    );
    const error = result.error as { expected?: boolean; sentence?: string };
    expect(error.sentence ?? null).toBe(sentence);
    expect(error.expected === true).toBe(expected);
  });
});

describe("addToFlowsheet refusals", () => {
  it.each([
    ["a spotlight_disabled 403", 403, { code: "spotlight_disabled" }, whosOnCopy.disabled],
    ["a closed_show 403", 403, { code: "closed_show" }, CLOSED_SHOW_SENTENCE],
    ["a 403 without a code", 403, { error: "forbidden" }, null],
    ["a 400", 400, { message: "Bad track" }, null],
  ])("%s", async (_name, status, body, sentence) => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet`, () =>
        HttpResponse.json(body, { status })
      )
    );
    const result = await createTestStore().dispatch(
      flowsheetApi.endpoints.addToFlowsheet.initiate({
        entry_type: "spotlight",
        spotlight_role: "dj",
        spotlight_name: "x",
      } as never)
    );
    const error = result.error as { expected?: boolean; sentence?: string };
    expect(error.sentence ?? null).toBe(sentence);
    expect(error.expected === true).toBe(sentence !== null);
  });
});

describe("joinShow refusals", () => {
  it.each([
    ["a tagged 400", { specialty_id: 4 }, ONE_TAP_TAG_REFUSED_SENTENCE],
    ["an untagged 400", {}, null],
    ["a title-only 400", { show_name: "x" }, null],
  ])("%s", async (_name, tag, sentence) => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/join`, () =>
        HttpResponse.json({ message: "no" }, { status: 400 })
      )
    );
    const result = await createTestStore().dispatch(
      flowsheetApi.endpoints.joinShow.initiate({ dj_id: "d", ...tag } as never)
    );
    const error = result.error as { expected?: boolean; sentence?: string };
    expect(error.sentence ?? null).toBe(sentence);
    expect(error.expected === true).toBe(sentence !== null);
  });
});

describe("refusalSentence", () => {
  it.each([
    ["a 400", 400, undefined, "badRequest sentence"],
    ["a closed_show 403", 403, { code: "closed_show" }, CLOSED_SHOW_SENTENCE],
    ["a 403 without a code", 403, { error: "forbidden" }, null],
    ["a 403 with another code", 403, { code: "banned" }, null],
    ["a 403 with no body", 403, null, null],
    ["a 401", 401, { code: "closed_show" }, null],
    ["a 500", 500, undefined, null],
  ])("%s", (_name, status, data, expected) => {
    for (const badRequest of [NOT_ON_SHOW_SENTENCE, REJECTED_PROGRAM_SENTENCE]) {
      expect(refusalSentence({ status, data }, badRequest)).toBe(
        expected === "badRequest sentence" ? badRequest : expected
      );
    }
  });

  it("leaves a 400 to general handling without a sentence, and words extra codes", () => {
    expect(refusalSentence({ status: 400 })).toBeNull();
    expect(
      refusalSentence({ status: 403, data: { code: "x" } }, undefined, { x: "ex" })
    ).toBe("ex");
    expect(
      refusalSentence({ status: 400, data: { code: "x" } }, undefined, { x: "ex" })
    ).toBeNull();
  });
});
