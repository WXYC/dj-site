import { fetchBaseQuery } from "@reduxjs/toolkit/query";
import { getJWTToken } from "./authentication/client";

export const backendBaseQuery = (domain: string) => fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/${domain}`,
  prepareHeaders: async (headers) => {
    headers.set("Content-Type", "application/json");
    
    // Get JWT token from better-auth /token endpoint
    const token = await getJWTToken();
    
    if (token) {
      // Use Bearer format for better-auth JWT tokens
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});
