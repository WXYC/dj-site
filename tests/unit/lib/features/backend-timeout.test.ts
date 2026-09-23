import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn(async () => null),
}));

vi.mock("@/lib/error-reporting", () => ({
  safeCaptureException: vi.fn(),
}));

// Capture what each endpoint hands the transport. `fetchBaseQuery` consumes
// `timeout` internally (it becomes an abort signal that never reaches the
// `Request`), so the arguments crossing this boundary are the only place a
// per-endpoint override is observable without waiting out real time.
const { recordedArgs, recordedConfigs, mockFetchBaseQuery } = vi.hoisted(() => {
  const recorded: any[] = [];
  const configs: any[] = [];
  const factory = vi.fn((config: any) => {
    configs.push(config);
    return async (args: any) => {
      recorded.push(args);
      return { data: null };
    };
  });
  return { recordedArgs: recorded, recordedConfigs: configs, mockFetchBaseQuery: factory };
});

vi.mock("@reduxjs/toolkit/query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@reduxjs/toolkit/query")>()),
  fetchBaseQuery: (config: any) => mockFetchBaseQuery(config),
}));

import {
  BACKEND_REQUEST_TIMEOUT_MS,
  LML_BACKED_REQUEST_TIMEOUT_MS,
} from "@/lib/features/backend";
import { catalogApi } from "@/lib/features/catalog/api";
import { makeStore } from "@/lib/store";

const lastArgs = () => recordedArgs[recordedArgs.length - 1];

describe("request timeouts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    recordedArgs.length = 0;
    process.env = { ...originalEnv, NEXT_PUBLIC_BACKEND_URL: "https://api.example.com" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("bounds every API slice's requests", () => {
    // One base query per slice, all built from the same factory: the ceiling
    // has to reach every one of them, not just the flowsheet's.
    expect(recordedConfigs.length).toBeGreaterThan(1);
    for (const config of recordedConfigs) {
      expect(Number.isFinite(config.timeout)).toBe(true);
      expect(config.timeout).toBeGreaterThan(0);
    }
  });

  it("raises the ceiling for the whole metadata-lookup proxy namespace", () => {
    const proxyConfigs = recordedConfigs.filter((config) =>
      config.baseUrl.endsWith("/proxy")
    );
    const directConfigs = recordedConfigs.filter(
      (config) => !config.baseUrl.endsWith("/proxy")
    );

    // Both slices under the namespace, not just the one named for the service.
    expect(proxyConfigs.length).toBeGreaterThan(1);
    for (const config of proxyConfigs) {
      expect(config.timeout).toBe(LML_BACKED_REQUEST_TIMEOUT_MS);
    }

    expect(directConfigs.length).toBeGreaterThan(0);
    for (const config of directConfigs) {
      expect(config.timeout).toBe(BACKEND_REQUEST_TIMEOUT_MS);
    }
  });

  it("gives the default no room to expire before a healthy backend answers", () => {
    // Production reads settle around 230 ms; the default must clear that by a
    // wide margin or it converts slowness into failure.
    expect(BACKEND_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
  });

  it("gives LML-backed endpoints room for a cold cascade", () => {
    expect(LML_BACKED_REQUEST_TIMEOUT_MS).toBeGreaterThan(BACKEND_REQUEST_TIMEOUT_MS);
    // The slowest observed cold cascade was just under 23 s.
    expect(LML_BACKED_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(23_000);
  });

  it("raises the ceiling for a cascade-backed endpoint outside that namespace", async () => {
    const store = makeStore();

    await store.dispatch(
      catalogApi.endpoints.getDiscogsPrefill.initiate("https://www.discogs.com/release/1")
    );

    expect(lastArgs().timeout).toBe(LML_BACKED_REQUEST_TIMEOUT_MS);
  });

  it("leaves the rest of the catalog slice on the default ceiling", async () => {
    const store = makeStore();

    await store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Jessica Pratt",
        album_title: undefined,
        n: 10,
      })
    );

    expect(lastArgs().timeout).toBeUndefined();
  });
});
