import { Authorization } from "@/lib/features/admin/types";
import {
  AuthenticatedUser,
  User,
} from "@/lib/features/authentication/types";
import {
  AlbumEntry,
  AlbumQueryResponse,
  ArtistEntry,
  Genre,
} from "@/lib/features/catalog/types";
import {
  FlowsheetQuery,
  FlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import type { RotationBin } from "@wxyc/shared";
import { TEST_ENTITY_IDS, TEST_SEARCH_STRINGS } from "./constants";
import { TEST_TIMESTAMPS, toDateString } from "./time";

// Artist fixtures
export function createTestArtist(overrides: Partial<ArtistEntry> = {}): ArtistEntry {
  return {
    id: TEST_ENTITY_IDS.ARTIST.ROCK_ARTIST,
    name: TEST_SEARCH_STRINGS.ARTIST_NAME,
    lettercode: "TA",
    numbercode: 1,
    genre: "Rock",
    ...overrides,
  };
}

// Album fixtures
export function createTestAlbum(overrides: Partial<AlbumEntry> = {}): AlbumEntry {
  return {
    id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
    title: TEST_SEARCH_STRINGS.ALBUM_NAME,
    artist: createTestArtist(),
    entry: 1,
    format: "CD",
    alternate_artist: undefined,
    rotation_bin: undefined,
    rotation_id: undefined,
    plays: 0,
    add_date: toDateString(TEST_TIMESTAMPS.ONE_WEEK_AGO),
    label: TEST_SEARCH_STRINGS.LABEL,
    ...overrides,
  };
}

// Album query response (raw API response format)
export function createTestAlbumQueryResponse(
  overrides: Partial<AlbumQueryResponse> = {}
): AlbumQueryResponse {
  return {
    id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
    add_date: toDateString(TEST_TIMESTAMPS.ONE_WEEK_AGO),
    album_dist: undefined,
    album_title: TEST_SEARCH_STRINGS.ALBUM_NAME,
    artist_dist: undefined,
    artist_name: TEST_SEARCH_STRINGS.ARTIST_NAME,
    code_artist_number: 1,
    code_letters: "TA",
    code_number: 1,
    format_name: "CD",
    genre_name: "Rock",
    label: TEST_SEARCH_STRINGS.LABEL,
    rotation_bin: undefined,
    plays: 0,
    rotation_id: undefined,
    ...overrides,
  };
}

// Flowsheet entry fixtures
export function createTestFlowsheetEntry(
  overrides: Partial<FlowsheetSongEntry> = {}
): FlowsheetSongEntry {
  return {
    id: TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1,
    play_order: 1,
    show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW,
    track_title: TEST_SEARCH_STRINGS.TRACK_TITLE,
    artist_name: TEST_SEARCH_STRINGS.ARTIST_NAME,
    album_title: TEST_SEARCH_STRINGS.ALBUM_NAME,
    record_label: TEST_SEARCH_STRINGS.LABEL,
    request_flag: false,
    album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
    rotation_id: undefined,
    rotation_bin: undefined,
    ...overrides,
  };
}

// Flowsheet query fixtures
export function createTestFlowsheetQuery(
  overrides: Partial<FlowsheetQuery> = {}
): FlowsheetQuery {
  return {
    song: TEST_SEARCH_STRINGS.TRACK_TITLE,
    artist: TEST_SEARCH_STRINGS.ARTIST_NAME,
    album: TEST_SEARCH_STRINGS.ALBUM_NAME,
    label: TEST_SEARCH_STRINGS.LABEL,
    request: false,
    album_id: undefined,
    rotation_bin: undefined,
    rotation_id: undefined,
    ...overrides,
  };
}

// User fixtures
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    username: "testdj",
    email: "testdj@wxyc.org",
    realName: "Test DJ",
    djName: "DJ Test",
    authority: Authorization.DJ,
    ...overrides,
  };
}

// Authenticated user fixtures
export function createTestAuthenticatedUser(
  overrides: Partial<AuthenticatedUser> = {}
): AuthenticatedUser {
  return {
    user: createTestUser(overrides.user),
    accessToken: "test-access-token-12345",
    idToken: "test-id-token-12345",
    ...overrides,
  };
}

// List factories
export function createTestAlbumList(count: number = 3): AlbumEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createTestAlbum({
      id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM + index,
      title: `${TEST_SEARCH_STRINGS.ALBUM_NAME} ${index + 1}`,
      artist: createTestArtist({
        id: TEST_ENTITY_IDS.ARTIST.ROCK_ARTIST + index,
        name: `${TEST_SEARCH_STRINGS.ARTIST_NAME} ${index + 1}`,
      }),
    })
  );
}

export function createTestFlowsheetEntryList(count: number = 3): FlowsheetSongEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createTestFlowsheetEntry({
      id: TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1 + index,
      play_order: index + 1,
      track_title: `${TEST_SEARCH_STRINGS.TRACK_TITLE} ${index + 1}`,
    })
  );
}

// Rotation-specific album factory
export function createTestRotationAlbum(
  rotation: RotationBin,
  overrides: Partial<AlbumEntry> = {}
): AlbumEntry {
  return createTestAlbum({
    id: TEST_ENTITY_IDS.ALBUM.ROTATION_ALBUM,
    rotation_bin: rotation,
    rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
    ...overrides,
  });
}
