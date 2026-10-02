import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";
import { createTestStore, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { rotationApi } from "@/lib/features/rotation/api";
import type { AppStore } from "@/lib/store";
import { useCardAssignmentSave } from "@/src/components/experiences/modern/admin/rotation/useCardAssignmentSave";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const CARD_ID = 3;

function wrapper(store: AppStore): (props: PropsWithChildren) => ReactElement {
  return ({ children }) => <Provider store={store}>{children}</Provider>;
}

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
  const failing = new Set<number>();
  const bodies: { id: number; body: unknown }[] = [];

  server.use(
    http.patch(`${TEST_BACKEND_URL}/library/rotation/:id`, async ({ request, params }) => {
      const id = Number(params.id);
      bodies.push({ id, body: await request.json() });
      await new Promise<void>((resolve) => resolvers.set(id, resolve));
      if (failing.has(id)) {
        return HttpResponse.json({ message: "refused" }, { status: 500 });
      }
      return HttpResponse.json(row(id));
    }),
  );

  return {
    // Rows move one at a time, so the loop issues its next PATCH only once
    // the current one resolves -- waiting for the request to land before
    // releasing it is what keeps these releases from racing the loop.
    releaseOnceRequested: async (id: number) => {
      await waitFor(() => expect(bodies.map((call) => call.id)).toContain(id));
      resolvers.get(id)?.();
    },
    failFor: (ids: number[]) => {
      failing.clear();
      ids.forEach((id) => failing.add(id));
    },
    bodies: () => [...bodies],
  };
}

function installCardsReadCounter() {
  let requests = 0;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/rotation/cards`, () => {
      requests += 1;
      return HttpResponse.json([]);
    }),
  );
  return { requests: () => requests };
}

describe("useCardAssignmentSave", () => {
  it("advances progress one record at a time to N of N", async () => {
    const handler = installGatedCardMoveHandler();
    const store = createTestStore();
    const { result } = renderHook(() => useCardAssignmentSave(CARD_ID), {
      wrapper: wrapper(store),
    });

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

  it("reports a failing row as failed and the rest as moved", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901]);
    const store = createTestStore();
    const { result } = renderHook(() => useCardAssignmentSave(CARD_ID), {
      wrapper: wrapper(store),
    });

    act(() => {
      void result.current.save([900, 901, 902]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await handler.releaseOnceRequested(902);

    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.results.get(900)).toEqual({ ok: true });
    expect(result.current.results.get(901)).toMatchObject({ ok: false });
    expect(result.current.results.get(902)).toEqual({ ok: true });
  });

  it("retry resends only the failed row", async () => {
    const handler = installGatedCardMoveHandler();
    handler.failFor([901]);
    const store = createTestStore();
    const { result } = renderHook(() => useCardAssignmentSave(CARD_ID), {
      wrapper: wrapper(store),
    });

    act(() => {
      void result.current.save([900, 901]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.results.get(901)).toMatchObject({ ok: false });

    // The retried row now goes through: a librarian who retries after fixing
    // whatever the server refused for expects the resend to actually land.
    handler.failFor([]);
    act(() => {
      void result.current.retry();
    });
    await handler.releaseOnceRequested(901);
    await waitFor(() => expect(result.current.running).toBe(false));

    expect(handler.bodies().filter((call) => call.id === 901)).toHaveLength(2);
    expect(handler.bodies().filter((call) => call.id === 900)).toHaveLength(1);
    expect(result.current.progress).toEqual({ done: 1, total: 1 });
    expect(result.current.results.get(901)).toEqual({ ok: true });
  });

  it("refetches the cards read once per save, not once per row", async () => {
    const handler = installGatedCardMoveHandler();
    const cardsRead = installCardsReadCounter();
    const store = createTestStore();
    await store.dispatch(rotationApi.endpoints.getRotationCards.initiate());
    expect(cardsRead.requests()).toBe(1);

    const { result } = renderHook(() => useCardAssignmentSave(CARD_ID), {
      wrapper: wrapper(store),
    });

    act(() => {
      void result.current.save([900, 901, 902]);
    });
    await handler.releaseOnceRequested(900);
    await handler.releaseOnceRequested(901);
    await handler.releaseOnceRequested(902);

    await waitFor(() => expect(cardsRead.requests()).toBe(2));
    await waitFor(() => expect(result.current.running).toBe(false));
  });
});
