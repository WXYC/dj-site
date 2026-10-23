import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { showPlaylistApi } from "@/lib/features/show-playlist/api";
import { whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import { createTestV2SpotlightEntry } from "@/tests/fixtures/fixtures";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

function rowMessage(store: ReturnType<typeof createTestStore>) {
  const data = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
    store.getState()
  ).data;
  return (data?.pages ?? []).flat().find((e) => e.id === 7100) as
    | { message: string; spotlight_name: string }
    | undefined;
}

async function seed() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json([
        createTestV2SpotlightEntry({
          id: 7100,
          spotlight_role: "performer",
          spotlight_name: "Porch Static",
        }),
      ])
    )
  );
  const store = createTestStore();
  await store
    .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
    .unwrap();
  return store;
}

describe("updateFlowsheet on a who's-on row", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-words the row's message from its role and the new name before the server answers", async () => {
    const store = await seed();
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        await delay("infinite");
        return new HttpResponse(null, { status: 200 });
      })
    );

    void store.dispatch(
      flowsheetApi.endpoints.updateFlowsheet.initiate({
        entry_id: 7100,
        data: { spotlight_name: "Porch Static Duo" },
      })
    );

    await vi.waitFor(() => {
      expect(rowMessage(store)?.spotlight_name).toBe("Porch Static Duo");
    });
    expect(rowMessage(store)?.message).toBe("Porch Static Duo live in the studio");
  });

  it("returns the row to its old name and message when the write fails", async () => {
    const store = await seed();
    server.use(
      http.patch(
        `${TEST_BACKEND_URL}/flowsheet/`,
        () => new HttpResponse(null, { status: 500 })
      )
    );

    await store
      .dispatch(
        flowsheetApi.endpoints.updateFlowsheet.initiate({
          entry_id: 7100,
          data: { spotlight_name: "Porch Static Duo" },
        })
      )
      .unwrap()
      .catch(() => undefined);

    await vi.waitFor(() => {
      expect(rowMessage(store)?.spotlight_name).toBe("Porch Static");
    });
    expect(rowMessage(store)?.message).toBe("Porch Static live in the studio");
  });
});

describe("a refused write to a who's-on row", () => {
  const refuse = (code?: string) =>
    http.patch(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json(
        { ...(code ? { code } : {}), message: "Spotlight entries are not enabled" },
        { status: 403 }
      )
    );

  const rejection = async (
    run: (store: ReturnType<typeof createTestStore>) => Promise<unknown>
  ) => {
    const store = createTestStore();
    try {
      await run(store);
    } catch (error) {
      return error as { expected?: boolean; sentence?: string };
    }
    throw new Error("expected the write to be refused, but it was accepted");
  };

  it.each([
    [
      "live row",
      (store: ReturnType<typeof createTestStore>) =>
        store
          .dispatch(
            flowsheetApi.endpoints.updateFlowsheet.initiate({
              entry_id: 7100,
              data: { spotlight_name: "Porch Static Duo" },
            })
          )
          .unwrap(),
    ],
    [
      "ended-show row",
      (store: ReturnType<typeof createTestStore>) =>
        store
          .dispatch(
            showPlaylistApi.endpoints.updateShowEntry.initiate({
              showId: 9,
              entry_id: 7100,
              data: { spotlight_name: "Porch Static Duo" },
            })
          )
          .unwrap(),
    ],
  ])("words a spotlight_disabled rename on a %s", async (_label, run) => {
    server.use(refuse("spotlight_disabled"));
    const error = await rejection(run);
    expect(error?.expected).toBe(true);
    expect(error?.sentence).toBe(whosOnCopy.disabled);
  });

  it.each([
    ["no code", undefined],
    ["spotlight_disabled", "spotlight_disabled"],
  ])("leaves a live song-field edit refused with %s to the global toast", async (_l, code) => {
    server.use(refuse(code));
    const error = await rejection((store) =>
      store
        .dispatch(
          flowsheetApi.endpoints.updateFlowsheet.initiate({
            entry_id: 7100,
            data: { track_title: "la paradoja" },
          })
        )
        .unwrap()
    );
    expect(error?.expected).toBeUndefined();
    expect(error?.sentence).toBeUndefined();
  });

  it("leaves a closed_show refusal of a live song-field edit unworded, as before", async () => {
    server.use(refuse("closed_show"));
    const error = await rejection((store) =>
      store
        .dispatch(
          flowsheetApi.endpoints.updateFlowsheet.initiate({
            entry_id: 7100,
            data: { track_title: "la paradoja" },
          })
        )
        .unwrap()
    );
    expect(error?.sentence).toBeUndefined();
  });
});
