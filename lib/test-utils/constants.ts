// Test constants for consistent test data

// Test UUIDs for users
export const TEST_USER_IDS = {
  DJ_USER: "test-dj-user-001",
  MD_USER: "test-md-user-002",
  SM_USER: "test-sm-user-003",
  UNAUTHENTICATED: "test-unauth-user-004",
} as const;

// Test entity IDs
export const TEST_ENTITY_IDS = {
  ALBUM: {
    ROCK_ALBUM: 1001,
    JAZZ_ALBUM: 1002,
    ELECTRONIC_ALBUM: 1003,
    ROTATION_ALBUM: 1004,
  },
  ARTIST: {
    ROCK_ARTIST: 2001,
    JAZZ_ARTIST: 2002,
    ELECTRONIC_ARTIST: 2003,
  },
  FLOWSHEET: {
    ENTRY_1: 3001,
    ENTRY_2: 3002,
    ENTRY_3: 3003,
  },
  SHOW: {
    CURRENT_SHOW: 4001,
    PAST_SHOW: 4002,
  },
  ROTATION: {
    HEAVY: 5001,
    MEDIUM: 5002,
    LIGHT: 5003,
  },
} as const;

// Test strings for search queries
export const TEST_SEARCH_STRINGS = {
  ARTIST_NAME: "Test Artist",
  ALBUM_NAME: "Test Album",
  TRACK_TITLE: "Test Track",
  LABEL: "Test Label",
} as const;

// Backend URL for MSW handlers
export const TEST_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
