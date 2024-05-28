import { RotationQueryParameters } from "@/lib/services/catalog/frontend-types";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { CatalogResult, addRotationBackend, retrieveRotation } from "../..";
import { toast } from "sonner";


export const loadRotation = createAppAsyncThunk(
    "rotation/load",
    async (): Promise<CatalogResult[]> => {
        const data = await retrieveRotation();
        return data;
    }
);

export const addToRotation = createAppAsyncThunk(
    "rotation/add",
    async (body: RotationQueryParameters): Promise<boolean> => {

        const { data, error } = await addRotationBackend(body);

        if (error) {
            toast.error(`Could not add to rotation! ${error.message}`);
            console.error(error);
            return false;
        }

        console.log(data);
        return true;
    }
);