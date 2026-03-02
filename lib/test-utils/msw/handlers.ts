import { http, HttpResponse } from "msw";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// Base handlers that can be extended in individual tests
export const handlers = [
  // Catalog API handlers
  http.get(`${BACKEND_URL}/library/`, () => {
    // Return empty array by default - tests can override with specific handlers
    return HttpResponse.json([]);
  }),

  http.get(`${BACKEND_URL}/library/info`, () => {
    return HttpResponse.json({});
  }),

  http.get(`${BACKEND_URL}/library/formats`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BACKEND_URL}/library/genres`, () => {
    return HttpResponse.json([]);
  }),

  // Authentication API handlers
  http.get(`${BACKEND_URL}/authentication/`, () => {
    return HttpResponse.json({ message: "Not Authenticated" });
  }),

  // Flowsheet API handlers
  http.get(`${BACKEND_URL}/flowsheet/`, () => {
    return HttpResponse.json([]);
  }),

  // Rotation API handlers
  http.get(`${BACKEND_URL}/rotation/`, () => {
    return HttpResponse.json([]);
  }),
];
