import { describe, it, expect, vi } from "vitest";
import { catalogApi } from "@/lib/features/catalog/api";
import { describeApi } from "@/lib/test-utils";

// Mock the authentication client
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("catalogApi", () => {
  describeApi(catalogApi, {
    queries: ["searchCatalog", "getInformation", "getFormats", "getGenres"],
    mutations: ["addAlbum", "addArtist", "addFormat", "addGenre"],
    reducerPath: "catalogApi",
  });

  describe("searchCatalog endpoint", () => {
    it("should have searchCatalog endpoint defined", () => {
      expect(catalogApi.endpoints.searchCatalog).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.searchCatalog.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.searchCatalog.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(catalogApi.endpoints.searchCatalog.matchFulfilled).toBeDefined();
      expect(catalogApi.endpoints.searchCatalog.matchPending).toBeDefined();
      expect(catalogApi.endpoints.searchCatalog.matchRejected).toBeDefined();
    });
  });

  describe("getInformation endpoint", () => {
    it("should have getInformation endpoint defined", () => {
      expect(catalogApi.endpoints.getInformation).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.getInformation.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.getInformation.initiate).toBe("function");
    });

    it("should have match methods for state changes", () => {
      expect(catalogApi.endpoints.getInformation.matchFulfilled).toBeDefined();
    });
  });

  describe("getFormats endpoint", () => {
    it("should have getFormats endpoint defined", () => {
      expect(catalogApi.endpoints.getFormats).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.getFormats.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.getFormats.initiate).toBe("function");
    });
  });

  describe("getGenres endpoint", () => {
    it("should have getGenres endpoint defined", () => {
      expect(catalogApi.endpoints.getGenres).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.getGenres.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.getGenres.initiate).toBe("function");
    });
  });

  describe("mutation endpoints", () => {
    it("should have addAlbum endpoint defined", () => {
      expect(catalogApi.endpoints.addAlbum).toBeDefined();
      expect(catalogApi.endpoints.addAlbum.initiate).toBeDefined();
    });

    it("should have addArtist endpoint defined", () => {
      expect(catalogApi.endpoints.addArtist).toBeDefined();
      expect(catalogApi.endpoints.addArtist.initiate).toBeDefined();
    });

    it("should have addFormat endpoint defined", () => {
      expect(catalogApi.endpoints.addFormat).toBeDefined();
      expect(catalogApi.endpoints.addFormat.initiate).toBeDefined();
    });

    it("should have addGenre endpoint defined", () => {
      expect(catalogApi.endpoints.addGenre).toBeDefined();
      expect(catalogApi.endpoints.addGenre.initiate).toBeDefined();
    });
  });

  describe("API configuration", () => {
    it("should use catalogApi as reducer path", () => {
      expect(catalogApi.reducerPath).toBe("catalogApi");
    });

    it("should have reducer function", () => {
      expect(catalogApi.reducer).toBeDefined();
      expect(typeof catalogApi.reducer).toBe("function");
    });

    it("should have middleware function", () => {
      expect(catalogApi.middleware).toBeDefined();
      expect(typeof catalogApi.middleware).toBe("function");
    });
  });
});
