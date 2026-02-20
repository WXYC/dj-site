import {
  AdminAuthenticationStatus,
  Authorization,
  Account,
  AdminFrontendState,
} from "@/lib/features/admin/types";
import {
  AuthenticatedUser,
  AuthenticationState,
  ModifiableData,
  User,
  VerifiedData,
  Verification,
} from "@/lib/features/authentication/types";
import type { BinLibraryDetails } from "@wxyc/shared/dtos";
import type {
  FlowsheetV2TrackEntryJSON,
  FlowsheetV2ShowStartEntryJSON,
  FlowsheetV2ShowEndEntryJSON,
  FlowsheetV2DJJoinEntryJSON,
  FlowsheetV2DJLeaveEntryJSON,
  FlowsheetV2TalksetEntryJSON,
  FlowsheetV2BreakpointEntryJSON,
  FlowsheetV2MessageEntryJSON,
} from "@/lib/features/flowsheet/types";
import {
  AlbumEntry,
  AlbumSearchResultJSON,
  ArtistEntry,
  Genre,
} from "@/lib/features/catalog/types";
import {
  FlowsheetQuery,
  FlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import { Rotation } from "@/lib/features/rotation/types";
import { TEST_ENTITY_IDS, TEST_SEARCH_STRINGS } from "./constants";
import { TEST_TIMESTAMPS, toDateString, toISOString } from "./time";

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

// Album search result (raw API response format)
export function createTestAlbumSearchResult(
  overrides: Partial<AlbumSearchResultJSON> = {}
): AlbumSearchResultJSON {
  return {
    id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
    add_date: toDateString(TEST_TIMESTAMPS.ONE_WEEK_AGO),
    album_title: TEST_SEARCH_STRINGS.ALBUM_NAME,
    artist_name: TEST_SEARCH_STRINGS.ARTIST_NAME,
    code_artist_number: 1,
    code_letters: "TA",
    code_number: 1,
    format_name: "CD",
    genre_name: "Rock",
    label: TEST_SEARCH_STRINGS.LABEL,
    plays: 0,
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
    rotation: undefined,
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
    token: "test-id-token-12345",
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
  rotation: Rotation,
  overrides: Partial<AlbumEntry> = {}
): AlbumEntry {
  return createTestAlbum({
    id: TEST_ENTITY_IDS.ALBUM.ROTATION_ALBUM,
    rotation_bin: rotation,
    rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
    ...overrides,
  });
}

// Authentication fixtures
export function createTestVerificationState(
  overrides: Partial<Verification<VerifiedData>> = {}
): Verification<VerifiedData> {
  return {
    username: false,
    realName: false,
    djName: false,
    password: false,
    currentPassword: false,
    confirmPassword: false,
    code: false,
    ...overrides,
  };
}

export function createTestModificationState(
  overrides: Partial<Verification<ModifiableData>> = {}
): Verification<ModifiableData> {
  return {
    realName: false,
    djName: false,
    email: false,
    ...overrides,
  };
}

export function createTestAuthenticationState(
  overrides: Partial<AuthenticationState> = {}
): AuthenticationState {
  return {
    verifications: createTestVerificationState(overrides.verifications),
    modifications: createTestModificationState(overrides.modifications),
    required: overrides.required ?? ["username", "password", "confirmPassword"],
  };
}

// JWT payload fixture for testing toUser
export function createTestJWTPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "cognito:username": "testdj",
    email: "testdj@wxyc.org",
    name: "Test User",
    "custom:dj-name": "DJ Test",
    "cognito:groups": [],
    ...overrides,
  };
}

// Admin fixtures
export function createTestAccountResult(
  overrides: Partial<Account> = {}
): Account {
  return {
    userName: "testuser",
    realName: "Test User",
    djName: "DJ Test",
    authorization: Authorization.DJ,
    authType: AdminAuthenticationStatus.Confirmed,
    email: "test@wxyc.org",
    ...overrides,
  };
}

export function createTestAccountFormData(
  overrides: Partial<AdminFrontendState["formData"]> = {}
): AdminFrontendState["formData"] {
  return {
    authorization: Authorization.DJ,
    ...overrides,
  };
}

// AWS user type fixture for conversion testing
export function createTestAWSUser(
  overrides: {
    Username?: string;
    UserStatus?: "CONFIRMED" | "FORCE_CHANGE_PASSWORD" | "RESET_REQUIRED";
    Attributes?: Array<{ Name: string; Value: string }>;
  } = {}
) {
  return {
    Username: overrides.Username ?? "testuser",
    UserStatus: overrides.UserStatus ?? "CONFIRMED",
    Attributes: overrides.Attributes ?? [
      { Name: "name", Value: "Test User" },
      { Name: "custom:dj-name", Value: "DJ Test" },
      { Name: "email", Value: "test@wxyc.org" },
    ],
  };
}

// Bin fixtures
export function createTestBinResponse(
  overrides: Partial<BinLibraryDetails> = {}
): BinLibraryDetails {
  return {
    album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
    album_title: TEST_SEARCH_STRINGS.ALBUM_NAME,
    artist_name: TEST_SEARCH_STRINGS.ARTIST_NAME,
    code_artist_number: 1,
    code_letters: "TA",
    code_number: 42,
    format_name: "CD",
    genre_name: "Rock",
    label: TEST_SEARCH_STRINGS.LABEL,
    ...overrides,
  };
}

// On-air DJ fixtures
export function createTestOnAirDJResponse(
  overrides: { id?: number; dj_name?: string } = {}
) {
  return {
    id: overrides.id ?? 1,
    dj_name: overrides.dj_name ?? "Test DJ",
  };
}

// V2 flowsheet entry fixtures

const V2_ENTRY_BASE = {
  id: TEST_ENTITY_IDS.FLOWSHEET.ENTRY_1,
  show_id: TEST_ENTITY_IDS.SHOW.CURRENT_SHOW as number | null,
  play_order: 1,
  add_time: toISOString(TEST_TIMESTAMPS.NOW),
};

export function createTestV2TrackEntry(
  overrides: Partial<FlowsheetV2TrackEntryJSON> = {}
): FlowsheetV2TrackEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "track",
    track_title: TEST_SEARCH_STRINGS.TRACK_TITLE,
    artist_name: TEST_SEARCH_STRINGS.ARTIST_NAME,
    album_title: TEST_SEARCH_STRINGS.ALBUM_NAME,
    record_label: TEST_SEARCH_STRINGS.LABEL,
    request_flag: false,
    album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
    ...overrides,
  };
}

export function createTestV2ShowStartEntry(
  overrides: Partial<FlowsheetV2ShowStartEntryJSON> = {}
): FlowsheetV2ShowStartEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "show_start",
    dj_name: "Test DJ",
    timestamp: "6/15/2024, 2:30:00 PM",
    ...overrides,
  };
}

export function createTestV2ShowEndEntry(
  overrides: Partial<FlowsheetV2ShowEndEntryJSON> = {}
): FlowsheetV2ShowEndEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "show_end",
    dj_name: "Test DJ",
    timestamp: "6/15/2024, 4:30:00 PM",
    ...overrides,
  };
}

export function createTestV2DJJoinEntry(
  overrides: Partial<FlowsheetV2DJJoinEntryJSON> = {}
): FlowsheetV2DJJoinEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "dj_join",
    dj_name: "Test DJ",
    ...overrides,
  };
}

export function createTestV2DJLeaveEntry(
  overrides: Partial<FlowsheetV2DJLeaveEntryJSON> = {}
): FlowsheetV2DJLeaveEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "dj_leave",
    dj_name: "Test DJ",
    ...overrides,
  };
}

export function createTestV2TalksetEntry(
  overrides: Partial<FlowsheetV2TalksetEntryJSON> = {}
): FlowsheetV2TalksetEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "talkset",
    message: "Talkset about upcoming event",
    ...overrides,
  };
}

export function createTestV2BreakpointEntry(
  overrides: Partial<FlowsheetV2BreakpointEntryJSON> = {}
): FlowsheetV2BreakpointEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "breakpoint",
    message: "Breakpoint",
    ...overrides,
  };
}

export function createTestV2MessageEntry(
  overrides: Partial<FlowsheetV2MessageEntryJSON> = {}
): FlowsheetV2MessageEntryJSON {
  return {
    ...V2_ENTRY_BASE,
    entry_type: "message",
    message: "Custom message",
    ...overrides,
  };
}
