import { JoinRequestBody } from "@/lib/services/flowsheet/backend-types";
import { createAppAsyncThunk } from "../../createAppAsyncThunk";
import { setter } from "../..";

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