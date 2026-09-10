import type { FlowsheetRangeEntry } from "@wxyc/shared";
import type { RotationBin } from "@/lib/features/rotation/types";

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
 * A V2 entry as the route projects it. Deliberately loose: the wire is a
 * discriminated union, but every consumer here reads it through
 * `v2ToRangeShape`, which is where the narrowing happens.
 */
export type ShowPlaylistEntryWire = {
  id: number;
  show_id: number | null;
  play_order: number;
  add_time: string;
  entry_type?: FlowsheetRangeEntry["entry_type"];
  message?: string | null;
  radio_hour?: string | null;
  dj_name?: string | null;
  request_flag?: boolean;
  /**
   * The bin the release is filed under **now**. The route's primary lane joins
   * the rotation row on its id with no window against the air date, so this is
   * not a claim about the bin the release aired under.
   */
  rotation_bin?: RotationBin;
  /**
   * Three-state. Null is "no linked library row", which says nothing about
   * streaming availability, so it must stay distinct from `false`.
   */
  on_streaming?: boolean | null;
  [key: string]: unknown;
};

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
