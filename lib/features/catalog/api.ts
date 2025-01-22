import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";


export const catalogApi = createApi({
    reducerPath: "catalogApi",
    baseQuery: backendBaseQuery("library"),
    endpoints: (builder) => ({
        searchCatalog: builder.query<any, { artist_name: string | undefined, album_name: string | undefined }>({
            query: ({ artist_name, album_name }) => ({
                url: "/",
                params: { artist_name, album_name },
            }),
        }),
    }),
});

export const { useSearchCatalogQuery } = catalogApi;