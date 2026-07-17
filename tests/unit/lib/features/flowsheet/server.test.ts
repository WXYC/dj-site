import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  fetchNowPlayingSeed,
  fetchWhoIsLiveSeed,
} from "@/lib/features/flowsheet/server";
import type {
  FlowsheetSongEntry,
  FlowsheetV2EntryJSON,
  OnAirDJResponse,
} from "@/lib/features/flowsheet/types";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

const BACKEND_URL = "http://backend.test";

describe("flowsheet server seeds", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchNowPlayingSeed", () => {
    const rawTrack: FlowsheetV2EntryJSON = {
      id: 42,
      play_order: 7,
      show_id: 3,
      add_time: "2024-11-01T00:00:00.000Z",
      entry_type: "track",
      track_title: "Back, Baby",
      artist_name: "Jessica Pratt",
      album_title: "On Your Own Love Again",
      record_label: "Drag City",
      request_flag: false,
      segue: false,
    };

    it("converts a fetched track entry", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(rawTrack)));
      const entry = (await fetchNowPlayingSeed()) as FlowsheetSongEntry;
      expect(entry).not.toBeNull();
      expect(entry.id).toBe(42);
      expect(entry.track_title).toBe("Back, Baby");
      expect(entry.artist_name).toBe("Jessica Pratt");
    });

    it("returns null when the backend reports nothing playing", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(null)));
      expect(await fetchNowPlayingSeed()).toBeNull();
    });

    it("fails open to undefined on a non-2xx response", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(rawTrack, false)));
      expect(await fetchNowPlayingSeed()).toBeUndefined();
    });

    it("fails open to undefined when the fetch rejects", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network down");
        }),
      );
      expect(await fetchNowPlayingSeed()).toBeUndefined();
    });

    it("fails open to undefined when the backend url is unset", async () => {
      delete process.env.NEXT_PUBLIC_BACKEND_URL;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      expect(await fetchNowPlayingSeed()).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("fetchWhoIsLiveSeed", () => {
    const rawOnAir: OnAirDJResponse[] = [{ id: "1", dj_name: "DJ Seed" }];

    it("summarizes the on-air DJs", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(rawOnAir)));
      const data = await fetchWhoIsLiveSeed();
      expect(data).toEqual({ djs: rawOnAir, onAir: "DJ Seed" });
    });

    it("returns the off-air shape for an empty on-air list", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
      const data = await fetchWhoIsLiveSeed();
      expect(data?.djs).toEqual([]);
      expect(data?.onAir).toBe("Off Air");
    });

    it("fails open to undefined when the fetch rejects", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("timeout");
        }),
      );
      expect(await fetchWhoIsLiveSeed()).toBeUndefined();
    });
  });
});
