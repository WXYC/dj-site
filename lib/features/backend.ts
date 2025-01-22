import { fetchBaseQuery } from "@reduxjs/toolkit/query";
import { RootState } from "../store";
import { AuthenticationData } from "./authentication/types";

export const backendBaseQuery = (domain: string) => fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/${domain}`,
  prepareHeaders: (headers, { getState }) => {
    const token = (
      (getState() as RootState).authenticationApi?.queries?.getAuthentication
        ?.data as AuthenticationData
    )?.accessToken;
    console.log("state", (getState() as RootState));
    console.log("auth", token);
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});
