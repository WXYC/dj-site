import { JoinRequestBody } from "@/lib/services/flowsheet/backend-types";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { FlowSheetEntry, getOnAirFromBackend, retrieveFlowsheet, setter } from "../..";
import { toast } from "sonner";

export const join = createAppAsyncThunk(
    "flowsheet/join",
    async (body: JoinRequestBody): Promise<boolean> => {

        const { data, error } = await setter("flowsheet/join")(body);

        console.log("data", data);
        console.log("error", error);

        return !error;
    }
);

export const leave = createAppAsyncThunk(
    "flowsheet/leave",
    async (body: JoinRequestBody): Promise<boolean> => {

        const { data, error } = await setter("flowsheet/end")(body);

        console.log("data", data);
        console.log("error", error);

        return !error;
    }
);

export const loadFlowsheet = createAppAsyncThunk(
    "flowsheet/loadFlowsheet",
    async (): Promise<FlowSheetEntry[]> => {
        const data = await retrieveFlowsheet();
        return data;
    }
);

export const getIsLive = createAppAsyncThunk(
    "flowsheet/getIsLive",
    async (id: number | null | undefined): Promise<boolean> => {
        if (!id) {
            return false;
        }

        const { data, error } = await getOnAirFromBackend(id);

        if (error) {
            console.error(error);
            toast.error("Did not properly confirm whether you are live!");
            return false;
        }

        console.log(data);

        return data;
    }
);