import { describe, it, expect } from "vitest";
import { makeStore } from "@/lib/store";
import type { RootState } from "@/lib/store";

type ApiWithEndpoints = {
  reducerPath: string;
  endpoints: Record<string, unknown>;
};

/**
 * Generates tests to verify that an RTK Query API has the expected endpoints.
 * Uses it.each for concise, parameterized tests.
 *
 * @example
 * describeApiEndpoints(catalogApi, {
 *   queries: ["searchCatalog", "getInformation", "getFormats", "getGenres"],
 *   mutations: ["addAlbum", "addArtist"],
 * });
 */
export function describeApiEndpoints(
  api: ApiWithEndpoints,
  config: {
    queries?: string[];
    mutations?: string[];
    reducerPath?: string;
  }
) {
  const { queries = [], mutations = [], reducerPath } = config;
  const allEndpoints = [...queries, ...mutations];

  describe("API structure", () => {
    if (allEndpoints.length > 0) {
      it.each(allEndpoints)("should have %s endpoint", (endpointName) => {
        expect(api.endpoints[endpointName]).toBeDefined();
      });
    }

    if (reducerPath) {
      it("should use the correct reducer path", () => {
        expect(api.reducerPath).toBe(reducerPath);
      });
    }
  });
}

/**
 * Generates tests to verify that an RTK Query API integrates correctly
 * with the Redux store.
 *
 * @example
 * describeApiStoreIntegration(catalogApi);
 */
export function describeApiStoreIntegration(api: ApiWithEndpoints) {
  describe("store integration", () => {
    it("should integrate with the Redux store", () => {
      const store = makeStore();
      const state = store.getState() as RootState & Record<string, unknown>;

      expect(state[api.reducerPath]).toBeDefined();
      expect((state[api.reducerPath] as { queries: unknown }).queries).toBeDefined();
      expect((state[api.reducerPath] as { mutations: unknown }).mutations).toBeDefined();
    });

    it("should initialize with empty queries and mutations", () => {
      const store = makeStore();
      const state = store.getState() as RootState & Record<string, unknown>;
      const apiState = state[api.reducerPath] as {
        queries: Record<string, unknown>;
        mutations: Record<string, unknown>;
      };

      expect(Object.keys(apiState.queries)).toHaveLength(0);
      expect(Object.keys(apiState.mutations)).toHaveLength(0);
    });
  });
}

/**
 * Combined helper that tests both API structure and store integration.
 *
 * @example
 * describeApi(catalogApi, {
 *   queries: ["searchCatalog", "getInformation"],
 *   mutations: ["addAlbum"],
 *   reducerPath: "catalogApi",
 * });
 */
export function describeApi(
  api: ApiWithEndpoints,
  config: {
    queries?: string[];
    mutations?: string[];
    reducerPath?: string;
  }
) {
  describeApiEndpoints(api, config);
  describeApiStoreIntegration(api);
}
