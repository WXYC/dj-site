import { http, HttpResponse } from "msw";
import type { FccNote } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";

export type FakeFccNoteOptions = {
  fccNotesForRelease?: Record<string, FccNote[]>;
  fccNotesForItem?: Record<string, FccNote[]>;
};

/**
 * The `fcc-notes` reads:
 *
 * - `GET /fcc-notes?album_id=` answers `fccNotesForRelease[album_id]` (empty when absent)
 * - `GET /fcc-notes?intake_item_id=` answers `fccNotesForItem[intake_item_id]` (empty when absent)
 * - any other `GET /fcc-notes` query answers an empty list
 */
export function fakeFccNoteEndpoints({ fccNotesForRelease = {}, fccNotesForItem = {} }: FakeFccNoteOptions = {}) {
  server.use(
    http.get(`${BACKEND_URL}/fcc-notes`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const albumId = query.get("album_id");
      const itemId = query.get("intake_item_id");
      if (albumId !== null) return HttpResponse.json(fccNotesForRelease[albumId] ?? []);
      if (itemId !== null) return HttpResponse.json(fccNotesForItem[itemId] ?? []);
      return HttpResponse.json([]);
    }),
  );
}
