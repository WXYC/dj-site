import type { FlowsheetV2EntryJSON } from "@/lib/features/flowsheet/types";

/**
 * One show as `GET /flowsheet/playlist?show_id=` actually serves it.
 *
 * `@wxyc/shared`'s `ShowPlaylist` describes a different response: it declares
 * v1 `entries`, names the specialty field `specialty_show`, and marks every
 * field optional. The route emits V2-projected entries, sends
 * `specialty_show_name`, and identifies the show as `id` — it spreads the
 * `shows` row, whose primary key is `id`, not `show_id`.
 */
export type ShowPlaylistWire = {
  id: number;
  show_name: string | null;
  /** Empty string, not absent, when the show is not a specialty show. */
  specialty_show_name: string;
  start_time: string;
  /** Null when the sign-off was never recorded, which is permanent. */
  end_time: string | null;
  /**
   * Empty for a show with no membership rows — every show imported from
   * tubafrenzy, which is most of the archive. The handle for those lives in
   * `legacy_dj_name`, so a consumer reading only this field shows no DJ on
   * almost every historical set.
   */
  show_djs: { id: string | number; dj_name: string | null }[];
  dj_name_override: string | null;
  legacy_dj_name: string | null;
  entries: ShowPlaylistEntryWire[];
};

/**
 * A V2 entry as the route projects it: the published union, under a local name.
 *
 * Not restated here. `GET /flowsheet/playlist` runs `getShowInfo` →
 * `projectEntriesV2` → `transformToV2` (Backend-Service
 * `apps/backend/services/flowsheet.service.ts`), the same projection
 * `FlowsheetV2PaginatedResponse` is declared for, so `api.yaml`'s discriminated
 * union already describes this payload field for field — `rotation_bin` and the
 * three-state `on_streaming` included. A local mirror of it behind an index
 * signature would type-check against a renamed field forever: the screen would
 * simply stop badging, and the fixtures built from the mirror would keep
 * passing.
 *
 * `FlowsheetV2EntryJSON` rather than `@wxyc/shared`'s `FlowsheetV2Entry`
 * directly, because that is already this repo's name for the published union as
 * it arrives over JSON — what `convertV2Entry`, the flowsheet api layer, the
 * server seed and the `createTestV2*Entry` factories all speak — and it carries
 * the `discogsUnavailable` pair BS serves flat on the track variant ahead of the
 * pinned dependency. Naming it here rather than at every use site is the only
 * thing this alias does.
 *
 * One residual disagreement, upstream of here and not papered over: the read
 * path types `rotation_bin` `string | null` and `transformToV2` emits it
 * un-coalesced, so a play with no rotation row — the common case — carries a
 * literal null that `api.yaml` declares non-nullable. Nothing on this path
 * misreads it (`capsulesForSongEntry` tests truthiness, and `Capsulable`
 * already admits a null), and the flat shape it converts into under-declares it
 * identically, so no cast or coercion here can launder it. The fix belongs in
 * `api.yaml`.
 *
 * Also note: the bin is the one the release is filed under **now**. The route's
 * primary lane joins the rotation row on its id with no window against the air
 * date, so it is not a claim about the bin the play aired under.
 */
export type ShowPlaylistEntryWire = FlowsheetV2EntryJSON;

export const EMPTY_SHOW_PLAYLIST: ShowPlaylistWire = {
  id: 0,
  show_name: null,
  specialty_show_name: "",
  start_time: "",
  end_time: null,
  show_djs: [],
  dj_name_override: null,
  legacy_dj_name: null,
  entries: [],
};
