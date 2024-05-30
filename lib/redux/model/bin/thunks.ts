import { toast } from "sonner";
import { BBinResult, BinMultiQueryParameters, BinQueryParameters, CatalogResult, addToBinBackend, convertBinResult, getBinFromBackend, removeFromBinBackend } from "../..";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";


export const loadBin = createAppAsyncThunk(
    "bin/loadBin",
    async (dj_id: number): Promise<CatalogResult[]> => {

        const { data, error } = await getBinFromBackend(dj_id);

        if (error) {
            toast.error(error.message);
            return [];
        }
    
        return data?.map((item: BBinResult) => convertBinResult(item));
        
    }
);

export const insertToBin = createAppAsyncThunk(
    "bin/insertToBin",
    async (query: BinQueryParameters): Promise<void> => {
        
        const { data, error } = await addToBinBackend(query.entry.id, query.dj.djId);

        if (error) {
            toast.error(error.message);
            return;
        }

        toast.success("Item added to bin");
    }
);

export const deleteAllFromBin = createAppAsyncThunk(
    "bin/deleteAllFromBin",
    async (queries: BinMultiQueryParameters): Promise<void> => {
        
        await Promise.all(
            queries.entry.map((entry) => removeFromBinBackend(queries.dj.djId, entry.id))
        );

    }
);

export const deleteFromBin = createAppAsyncThunk(
    "bin/deleteFromBin",
    async (query: BinQueryParameters): Promise<void> => {
        
        const { data, error } = await removeFromBinBackend(query.dj.djId, query.entry.id);

        if (error) {
            toast.error(error.message);
            return;
        }

        console.log(data);

        toast.success("Item removed from bin");
    }
);