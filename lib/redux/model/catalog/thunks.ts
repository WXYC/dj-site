import { CatalogResult, SearchParameters, getReleasesMatching } from "../..";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";

export const searchCatalog = createAppAsyncThunk(
    "catalog/searchCatalog",
    async (search: SearchParameters): Promise<CatalogResult[]> => {
        
        if (search.term.length < 3) return [];

        const result = await getReleasesMatching(search);

        return result ?? [];
    }
);

