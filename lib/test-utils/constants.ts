// Re-export shared test constants
export {
  TEST_USER_IDS,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@wxyc/shared";

// Backend URL for MSW handlers (frontend-specific)
export const TEST_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
