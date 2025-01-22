import { fetchBaseQuery } from "@reduxjs/toolkit/query";
import { RootState } from "../store";
import { AuthenticationData } from "./authentication/types";

export const backendBaseQuery = (domain: string) => fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/${domain}`,
  prepareHeaders: (headers, { getState }) => {
    headers.set("Content-Type", "application/json");
    const token = (
      (getState() as RootState).authenticationApi?.queries?.["getAuthentication(undefined)"]
        ?.data as AuthenticationData
    )?.accessToken;
    if (token) {
      headers.set("Authorization", token);
    }
    return headers;
  },
});
