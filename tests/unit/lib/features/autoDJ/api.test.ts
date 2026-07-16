import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

// getJWTToken hits the auth client; stub it so the test exercises only the
// orchestrator base query's error handling.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn(async () => null),
}));

beforeEach(() => {
  vi.resetModules();
  // api.ts reads NEXT_PUBLIC_ORCHESTRATOR_URL at module load; set it before import.
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL = "http://localhost:8090";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_ORCHESTRATOR_URL;
});

async function loadStore() {
  const { autoDJApi } = await import("@/lib/features/autoDJ/api");
  const store = configureStore({
    reducer: { [autoDJApi.reducerPath]: autoDJApi.reducer },
    middleware: (gdm) => gdm().concat(autoDJApi.middleware),
  });
  return { autoDJApi, store };
}

describe("autoDJApi", () => {
  it("swallows orchestrator failures so the 10s poll never surfaces a toast/error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("orchestrator down");
      }),
    );
    const { autoDJApi, store } = await loadStore();
    const result = await store.dispatch(
      autoDJApi.endpoints.getAutoDJStatus.initiate(),
    );
    // Fail silent: no rejected query (which the global error logger would toast),
    // just undefined data -> the UI shows no auto-DJ state.
    expect(result.isError).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it("returns the parsed status on success", async () => {
    const status = { active: true };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })),
    );
    const { autoDJApi, store } = await loadStore();
    const result = await store.dispatch(
      autoDJApi.endpoints.getAutoDJStatus.initiate(),
    );
    expect(result.isError).toBe(false);
    expect(result.data).toEqual(status);
  });

  it("fails silent via the catch path when the base URL is relative (orchestrator URL unset)", async () => {
    // Unset the URL so the base URL is relative; constructing a Request from a
    // relative URL THROWS (outside fetchBaseQuery's inner try) — this exercises
    // the orchestratorBaseQuery catch block, not the returned-error branch.
    delete process.env.NEXT_PUBLIC_ORCHESTRATOR_URL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    const { autoDJApi, store } = await loadStore();
    const result = await store.dispatch(
      autoDJApi.endpoints.getAutoDJStatus.initiate(),
    );
    expect(result.isError).toBe(false);
    expect(result.data).toBeUndefined();
  });
});
