import { fetchBaseQuery } from "@reduxjs/toolkit/query";

export const backendBaseQuery = (domain: string) =>
  fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/${domain}`,
  });
