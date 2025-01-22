import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";

export const flowsheetApi = createApi({
  reducerPath: "flowsheetApi",
  baseQuery: backendBaseQuery("flowsheet"),
  tagTypes: ["NowPlaying"],
  endpoints: (builder) => ({
    getNowPlaying: builder.query<any, void>({
      query: () => ({
        url: "/latest",
      }),
      providesTags: ["NowPlaying"],
    }),
    getEntries: builder.query<any, void>({
      query: () => ({
        url: "/",
      }),
    }),
  }),
});

export const { useGetNowPlayingQuery } = flowsheetApi;
