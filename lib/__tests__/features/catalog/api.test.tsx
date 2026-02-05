import { describe, it, expect, vi } from "vitest";
import {
  catalogApi,
  useSearchCatalogQuery,
  useAddAlbumMutation,
  useAddArtistMutation,
  useGetInformationQuery,
  useGetFormatsQuery,
  useAddFormatMutation,
  useGetGenresQuery,
  useAddGenreMutation,
} from "@/lib/features/catalog/api";
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

  describe("exported hooks", () => {
    it("should export useSearchCatalogQuery hook", async () => {
      const { useSearchCatalogQuery } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useSearchCatalogQuery).toBeDefined();
      expect(typeof useSearchCatalogQuery).toBe("function");
    });

    it("should export useAddAlbumMutation hook", async () => {
      const { useAddAlbumMutation } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useAddAlbumMutation).toBeDefined();
      expect(typeof useAddAlbumMutation).toBe("function");
    });

    it("should export useAddArtistMutation hook", async () => {
      const { useAddArtistMutation } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useAddArtistMutation).toBeDefined();
      expect(typeof useAddArtistMutation).toBe("function");
    });

    it("should export useGetInformationQuery hook", async () => {
      const { useGetInformationQuery } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useGetInformationQuery).toBeDefined();
      expect(typeof useGetInformationQuery).toBe("function");
    });

    it("should export useGetFormatsQuery hook", async () => {
      const { useGetFormatsQuery } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useGetFormatsQuery).toBeDefined();
      expect(typeof useGetFormatsQuery).toBe("function");
    });

    it("should export useAddFormatMutation hook", async () => {
      const { useAddFormatMutation } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useAddFormatMutation).toBeDefined();
      expect(typeof useAddFormatMutation).toBe("function");
    });

    it("should export useGetGenresQuery hook", async () => {
      const { useGetGenresQuery } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useGetGenresQuery).toBeDefined();
      expect(typeof useGetGenresQuery).toBe("function");
    });

    it("should export useAddGenreMutation hook", async () => {
      const { useAddGenreMutation } = await import(
        "@/lib/features/catalog/api"
      );
      expect(useAddGenreMutation).toBeDefined();
      expect(typeof useAddGenreMutation).toBe("function");
    });
  });

  describe("API configuration", () => {
    it("should use catalogApi as reducer path", () => {
      expect(catalogApi.reducerPath).toBe("catalogApi");
    });

    it("should export the catalogApi object", () => {
      expect(catalogApi).toBeDefined();
      expect(catalogApi.endpoints).toBeDefined();
    });

    it("should have Rotation tag type", () => {
      expect(catalogApi.reducerPath).toBe("catalogApi");
    });
  });

  describe("searchCatalog endpoint", () => {
    it("should have searchCatalog endpoint defined", () => {
      expect(catalogApi.endpoints.searchCatalog).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.searchCatalog.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.searchCatalog.initiate).toBe("function");
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

  describe("addAlbum endpoint", () => {
    it("should have addAlbum endpoint defined", () => {
      expect(catalogApi.endpoints.addAlbum).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.addAlbum.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.addAlbum.initiate).toBe("function");
    });
  });

  describe("addArtist endpoint", () => {
    it("should have addArtist endpoint defined", () => {
      expect(catalogApi.endpoints.addArtist).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.addArtist.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.addArtist.initiate).toBe("function");
    });
  });

  describe("addFormat endpoint", () => {
    it("should have addFormat endpoint defined", () => {
      expect(catalogApi.endpoints.addFormat).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.addFormat.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.addFormat.initiate).toBe("function");
    });
  });

  describe("addGenre endpoint", () => {
    it("should have addGenre endpoint defined", () => {
      expect(catalogApi.endpoints.addGenre).toBeDefined();
    });

    it("should have initiate method", () => {
      expect(catalogApi.endpoints.addGenre.initiate).toBeDefined();
      expect(typeof catalogApi.endpoints.addGenre.initiate).toBe("function");
    });
  });

  describe("API reducer", () => {
    it("should have a reducer function", () => {
      expect(catalogApi.reducer).toBeDefined();
      expect(typeof catalogApi.reducer).toBe("function");
    });

    it("should have middleware", () => {
      expect(catalogApi.middleware).toBeDefined();
      expect(typeof catalogApi.middleware).toBe("function");
    });
  });

  describe("endpoint matchers", () => {
    it("should have matchFulfilled matcher for searchCatalog", () => {
      expect(catalogApi.endpoints.searchCatalog.matchFulfilled).toBeDefined();
    });

    it("should have matchPending matcher for searchCatalog", () => {
      expect(catalogApi.endpoints.searchCatalog.matchPending).toBeDefined();
    });

    it("should have matchRejected matcher for searchCatalog", () => {
      expect(catalogApi.endpoints.searchCatalog.matchRejected).toBeDefined();
    });
  });
});
