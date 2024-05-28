import { JoinRequestBody } from "@/lib/services/flowsheet/backend-types";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { FlowSheetEntry, getOnAirFromBackend, joinBackend, leaveBackend, retrieveFlowsheet, setter } from "../..";
import { toast } from "sonner";

export const join = createAppAsyncThunk(
    "flowsheet/join",
    async (body: JoinRequestBody): Promise<boolean> => {

        const { data, error } = await joinBackend(body.dj_id, body.show_name, body.specialty_id);

        if (error) {
            console.error(error);
            toast.error(`Could not join the show!\n${error.message}`);
            return false;
        }

        console.log(data);
        console.log(body);
        return true;
    }
);

export const leave = createAppAsyncThunk(
    "flowsheet/leave",
    async (body: JoinRequestBody): Promise<boolean> => {

        const { data, error } = await leaveBackend(body.dj_id);

        if (error) {
            console.error(error);
            toast.error(`Could not leave the show!\n${error.message}`);
            return false;
        }

        console.log(data);
        return true;
    }
);

export const loadFlowsheet = createAppAsyncThunk(
    "flowsheet/loadFlowsheet",
    async (): Promise<FlowSheetEntry[]> => {
        const data = await retrieveFlowsheet();
        return data;
    }
);

export const loadFlowsheetEntries = createAppAsyncThunk(
    "flowsheet/loadFlowsheetEntries",
    async (editDepth: number): Promise<FlowSheetEntry[]> => {
        const data = await retrieveFlowsheet(0, editDepth);
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