"use client";

import { useState } from "react";
import {
  useListDeletedArchiveQuery,
  useRestoreDeletedBatchMutation,
} from "@/lib/features/catalog/api";
import { DELETED_ARCHIVE_PAGE_LIMIT } from "@/lib/features/catalog/constants";
import { formatReleaseArtistTitle, formatReleaseCode } from "@/lib/features/catalog/libraryCode";
import {
  interpretRestoreError,
  type RestoreRefusal,
} from "@/lib/features/catalog/restoreDeletedBatchOutcome";
import type { DeletedArchiveBatch } from "@/lib/features/catalog/types";
import { formatStationDateTime } from "@/src/utilities/stationTime";
import { useAuthentication } from "@/src/hooks/authenticationHooks";

const CENTERED = { textAlign: "center" } as const;

function stringField(row: Record<string, unknown> | null, field: string): string | null {
  const value = row?.[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// "What the card was", from the captured parent row alone: the whole point of
// the archive is that the row it describes no longer exists to be read.
// `album_title` is only ever present on a `library` (release) row; an
// `artists` row carries `artist_name` alone -- the branch is on the data,
// never on `entity_kind`.
function batchSubject({ entities }: DeletedArchiveBatch): string {
  const row = entities[0]?.row ?? null;
  const albumTitle = stringField(row, "album_title");
  if (albumTitle) {
    return formatReleaseArtistTitle({
      alternate_artist_name: stringField(row, "alternate_artist_name"),
      album_artist_name: stringField(row, "artist_name"),
      album_title: albumTitle,
    });
  }
  return stringField(row, "artist_name") ?? "(details unavailable)";
}

// The release half of a call number alone, with no genre prefix and no
// artist letters: the captured `library` row has `code_number`/
// `code_volume_letters`/`genre_id` but not the artist's `code_letters`,
// which lives on `artists` and is never captured for a release-only batch.
// Resolving `genre_id` to a name is left for a follow-up polish pass. An
// `artists`-row batch has no release code at all.
function batchCallCode({ entities }: DeletedArchiveBatch): string {
  const row = entities[0]?.row ?? null;
  const codeNumber = row?.code_number;
  if (typeof codeNumber !== "number") return "";
  const codeVolumeLetters = stringField(row, "code_volume_letters");
  return formatReleaseCode({ code_number: codeNumber, code_volume_letters: codeVolumeLetters });
}

const NOT_RESTORABLE_MESSAGE =
  "No restore plan exists for this entry, so it cannot be brought back from this screen.";

type RowOutcome = { kind: "restored" } | { kind: "refused"; refusal: RestoreRefusal };

// Every reason a row cannot be restored goes through one wrapper, whichever
// branch produced it. A refusal rendered as bare cell text is announced to
// nobody and reads like ordinary column content, and the refusals that land in
// place of the button rather than beside it are the non-retryable ones — the
// more serious half, where another click cannot help.
function RestoreRefusalNotice({ children }: { children: string }) {
  return (
    <p role="alert" className="artist-error-message">
      {children}
    </p>
  );
}

/**
 * `/dashboard/library/deleted` — the permanent catalog-delete archive.
 * No `/wxycdb` equivalent exists:
 * `UndoService`'s single "Undo Last Change" link is what this screen
 * replaces with a searchable, paged, permanent record.
 *
 * Restore only ever succeeds when the card's original call-code slot is still
 * free. A taken slot, an already-restored batch, and a kind with no restore
 * plan all render as a readable refusal in place of the row's Restore button
 * — `restoreDeletedBatchOutcome.ts` owns the wording — never a silent failure
 * or a relocated card nobody asked to relocate. Offering a free code instead
 * of reporting the conflict is deliberately not this screen's job.
 *
 * `restorable` always comes from the listing row, never from `entity_kind`:
 * the server derives it from `RESTORE_PLAN`'s own key set, so a client-side
 * guess could drift from the set the restore endpoint actually honours.
 */
export default function DeletedArchiveListing() {
  const { authenticating, authenticated } = useAuthentication();
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, RowOutcome>>({});
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);

  const skip = authenticating || !authenticated;
  const { data, isLoading, isFetching, isUninitialized, isError } = useListDeletedArchiveQuery(
    { page, limit: DELETED_ARCHIVE_PAGE_LIMIT, search: appliedSearch || undefined },
    { skip },
  );
  const [restoreBatch] = useRestoreDeletedBatchMutation();

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(0);
  };

  const handleRestore = async (batchId: string) => {
    setPendingBatchId(batchId);
    setOutcomes(({ [batchId]: _cleared, ...rest }) => rest);
    try {
      await restoreBatch({ batchId }).unwrap();
      setOutcomes((prev) => ({ ...prev, [batchId]: { kind: "restored" } }));
    } catch (err) {
      setOutcomes((prev) => ({
        ...prev,
        [batchId]: { kind: "refused", refusal: interpretRestoreError(err) },
      }));
    } finally {
      setPendingBatchId(null);
    }
  };

  // `isUninitialized` is the state a skipped query sits in, and the skip lasts
  // as long as the session takes to resolve. Without it control falls to the
  // `!data` guard below and the screen claims the archive could not be loaded
  // on every single load, before a request has even been attempted.
  if (isUninitialized || isLoading) {
    return <p className="text">Loading...</p>;
  }

  if (isError || !data) {
    return (
      <p role="alert" className="artist-error-message" style={CENTERED}>
        The deleted-card archive could not be loaded.
      </p>
    );
  }

  const { results, total, totalPages } = data;

  return (
    <div style={CENTERED}>
      <p className="title">Recently Deleted</p>
      <form onSubmit={handleSearchSubmit}>
        <input
          type="text"
          size={40}
          placeholder="Search by artist or release title"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        &nbsp;
        <input type="submit" value="Search" />
      </form>
      <br />
      {results.length === 0 ? (
        <p className="text">
          {appliedSearch
            ? `No deleted cards match "${appliedSearch}".`
            : "Nothing has been deleted yet."}
        </p>
      ) : (
        <table className="entry-table">
          <thead>
            <tr className="entry-header">
              <th style={CENTERED}>Date</th>
              <th style={CENTERED}>Call Code</th>
              <th style={CENTERED}>What It Was</th>
              <th style={CENTERED}>Deleted By</th>
              <th style={CENTERED}>Restore</th>
            </tr>
          </thead>
          <tbody>
            {results.map((batch, index) => {
              const { time, day } = formatStationDateTime(batch.captured_at);
              const outcome = outcomes[batch.batch_id];
              return (
                <tr
                  key={batch.batch_id}
                  data-testid="deleted-archive-row"
                  className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
                >
                  <td style={CENTERED}>
                    {day} {time}
                  </td>
                  <td style={CENTERED}>{batchCallCode(batch)}</td>
                  <td>{batchSubject(batch)}</td>
                  <td style={CENTERED}>{batch.actor.role ?? "Unknown"}</td>
                  <td style={CENTERED} data-testid="deleted-archive-restore-cell">
                    {outcome?.kind === "restored" ? (
                      "Restored"
                    ) : !batch.restorable ? (
                      <RestoreRefusalNotice>{NOT_RESTORABLE_MESSAGE}</RestoreRefusalNotice>
                    ) : outcome?.kind === "refused" && !outcome.refusal.retryable ? (
                      <RestoreRefusalNotice>{outcome.refusal.message}</RestoreRefusalNotice>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRestore(batch.batch_id)}
                          disabled={pendingBatchId === batch.batch_id}
                        >
                          Restore
                        </button>
                        {outcome?.kind === "refused" && (
                          <RestoreRefusalNotice>{outcome.refusal.message}</RestoreRefusalNotice>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {totalPages > 1 && (
        <p className="text">
          <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 0 || isFetching}>
            Previous
          </button>
          &nbsp;Page {page + 1} of {totalPages} ({total} total)&nbsp;
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages || isFetching}
          >
            Next
          </button>
        </p>
      )}
    </div>
  );
}
