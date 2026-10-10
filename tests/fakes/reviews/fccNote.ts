import { http, HttpResponse } from "msw";
import type { FccNote } from "@wxyc/shared";
import { server } from "../server";
import { TEST_BACKEND_URL as BACKEND_URL } from "../../helpers/constants";

export type FakeFccNoteOptions = {
  fccNotesForRelease?: Record<string, FccNote[]>;
  fccNotesForItem?: Record<string, FccNote[]>;
  /** The unconfirmed notes `GET /fcc-notes?status=reported` answers. */
  fccNotesToConfirm?: FccNote[];
};

const CONFIRMER = "A Music Director";
const CONFIRMED_AT = "2026-10-03T12:00:00Z";

/**
 * The `fcc-notes` routes:
 *
 * - `GET /fcc-notes?album_id=` answers `fccNotesForRelease[album_id]` (empty when absent)
 * - `GET /fcc-notes?intake_item_id=` answers `fccNotesForItem[intake_item_id]` (empty when absent)
 * - `GET /fcc-notes?status=reported` answers `fccNotesToConfirm`
 * - `status` with a subject keeps only that status; every list is `reported_at` then `id` ascending
 * - any other `GET /fcc-notes` query answers an empty list
 * - `POST /fcc-notes/:id/confirm` answers the note as confirmed, stamped with `confirmed_by` and `confirmed_at`,
 *   and every read from then on carries it so and drops it from the `status=reported` list; 404 for an id no list names
 * - `DELETE /fcc-notes/:id` answers 204, and every read from then on drops the note; 404 for an id no list names
 */
export function fakeFccNoteEndpoints({
  fccNotesForRelease = {},
  fccNotesForItem = {},
  fccNotesToConfirm = [],
}: FakeFccNoteOptions = {}) {
  const known = [...Object.values(fccNotesForRelease).flat(), ...Object.values(fccNotesForItem).flat(), ...fccNotesToConfirm];
  const confirmed = new Set<number>();
  const removed = new Set<number>();
  const confirmedNote = (n: FccNote): FccNote => ({ ...n, status: "confirmed", confirmed_by: CONFIRMER, confirmed_at: CONFIRMED_AT });
  const current = (notes: FccNote[]) =>
    notes
      .filter((n) => !removed.has(n.id))
      .map((n) => (confirmed.has(n.id) ? confirmedNote(n) : n))
      .sort((a, b) => a.reported_at.localeCompare(b.reported_at) || a.id - b.id);

  server.use(
    http.get(`${BACKEND_URL}/fcc-notes`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const albumId = query.get("album_id");
      const itemId = query.get("intake_item_id");
      const status = query.get("status");
      const listed =
        albumId !== null
          ? (fccNotesForRelease[albumId] ?? [])
          : itemId !== null
            ? (fccNotesForItem[itemId] ?? [])
            : status === "reported"
              ? fccNotesToConfirm
              : [];
      return HttpResponse.json(current(listed).filter((n) => status === null || n.status === status));
    }),
    http.post(`${BACKEND_URL}/fcc-notes/:id/confirm`, ({ params }) => {
      const note = known.find((n) => String(n.id) === params.id);
      if (!note || removed.has(note.id)) return HttpResponse.json({ message: "Not found" }, { status: 404 });
      confirmed.add(note.id);
      return HttpResponse.json(confirmedNote(note));
    }),
    http.delete(`${BACKEND_URL}/fcc-notes/:id`, ({ params }) => {
      const note = known.find((n) => String(n.id) === params.id);
      if (!note || removed.has(note.id)) return HttpResponse.json({ message: "Not found" }, { status: 404 });
      removed.add(note.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
}
