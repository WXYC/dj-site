"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  useGetRotationListQuery,
  useGetUncataloguedRotationQuery,
  useKillRotationEntryMutation,
  useUnkillRotationEntryMutation,
} from "@/lib/features/rotation/api";
import {
  dedupeRotationListByArtistTitle,
  toDisplayRowFromList,
  toDisplayRowFromUncatalogued,
  type RotationDisplayRow,
} from "@/lib/features/rotation/classicList";
import {
  UNCATALOGUED_ROTATION_PAGE_SIZE,
  type RotationStatusFilter,
} from "@/lib/features/rotation/types";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";

const FACETS: { value: RotationStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "killed", label: "Killed" },
  { value: "uncataloged", label: "Awaiting Cataloging" },
];

function facetHref(status: RotationStatusFilter): string {
  return `/dashboard/rotation?status=${status}`;
}

/** A query-fed list must never render an unissued or failed request as "there are none". */
function OutagePanel({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
      Rotation releases are unavailable right now.{" "}
      <button type="button" disabled={retrying} onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}

function EmptyState() {
  return <p className="live-results-empty">No rotation releases found for this filter.</p>;
}

/**
 * The nine-column table body shared by every facet that has real rows to
 * show (Active, Awaiting Cataloging). Column set and order match
 * `rotationReleaseList.jsp` exactly: Actions, Artist, Title, Label, Type,
 * Format, Added, Killed, Library.
 *
 * Kill/Unkill, the Killed column and the Library column all key on whether
 * the row carries a kill date at all, never on whether that date has
 * arrived -- `release.killDate == 0` is the JSP's own test. A kill dated
 * next week leaves the row in rotation today and is still a kill, so it
 * shows its date and offers Unkill.
 */
function RotationTable({
  rows,
  onKill,
  onUnkill,
  pendingRotationIds,
}: {
  rows: RotationDisplayRow[];
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  pendingRotationIds: ReadonlySet<number>;
}) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <table className="entry-table" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <thead>
        <tr className="entry-header">
          <th style={{ textAlign: "center" }}>Actions</th>
          <th style={{ textAlign: "left" }}>Artist</th>
          <th style={{ textAlign: "left" }}>Title</th>
          <th style={{ textAlign: "left" }}>Label</th>
          <th style={{ textAlign: "center" }}>Type</th>
          <th style={{ textAlign: "center" }}>Format</th>
          <th style={{ textAlign: "center" }}>Added</th>
          <th style={{ textAlign: "center" }}>Killed</th>
          <th style={{ textAlign: "center" }}>Library</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const pending = pendingRotationIds.has(row.rotationId);
          return (
            <tr
              key={row.rotationId}
              className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
            >
              <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                {row.killedDisplay == null ? (
                  <button type="button" className="link-button" disabled={pending} onClick={() => onKill(row.rotationId)}>
                    Kill
                  </button>
                ) : (
                  <button type="button" className="link-button" disabled={pending} onClick={() => onUnkill(row.rotationId)}>
                    Unkill
                  </button>
                )}
              </td>
              <td>{row.artistName}</td>
              <td>{row.title}</td>
              <td>{row.label}</td>
              <td style={{ textAlign: "center" }}>{row.bin}</td>
              <td style={{ textAlign: "center" }}>{row.formatName}</td>
              <td style={{ textAlign: "center" }}>{row.addedDisplay}</td>
              <td style={{ textAlign: "center" }}>
                {row.killedDisplay ?? <span style={{ color: "#090" }}>Active</span>}
              </td>
              <td style={{ textAlign: "center" }}>
                {row.libraryStatus === "cataloged" ? (
                  <span style={{ color: "#090" }}>Cataloged</span>
                ) : row.libraryStatus === "uncataloged" ? (
                  <span style={{ color: "#CC0000" }}>Uncataloged</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The Active facet: `GET /library/rotation`. Backend already restricts this
 * to active rows (`kill_date IS NULL OR kill_date > CURRENT_DATE`) and
 * DISTINCT-collapses same-(album, bin) duplicates; deduping again here on
 * artist + title catches a re-add under a *different* bin, which Backend's
 * own collapse does not reach.
 */
function ActiveFacet({
  onKill,
  onUnkill,
  pendingRotationIds,
}: {
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  pendingRotationIds: ReadonlySet<number>;
}) {
  const { data, isLoading, isFetching, isError, refetch } = useGetRotationListQuery();

  // Absence-of-list, not the error flag: a background refetch can leave
  // isError true while the last-good rows are still on screen, and a
  // request that never went out reports neither.
  const hasNothingToShow = isError && data == null;

  if (isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;
  if (hasNothingToShow) return <OutagePanel onRetry={refetch} retrying={isFetching} />;

  const rows = dedupeRotationListByArtistTitle(data ?? []).map((row) => toDisplayRowFromList(row));
  return <RotationTable rows={rows} onKill={onKill} onUnkill={onUnkill} pendingRotationIds={pendingRotationIds} />;
}

/**
 * The Awaiting Cataloging facet: `GET /library/rotation/uncatalogued`.
 * Defaults to the active-only subset (~164 rows measured at ticket time)
 * with an opt-in toggle for the full killed-and-uncatalogued backlog
 * (~3,673) -- "all 3,837 by default is a graveyard, not a worklist."
 *
 * Deliberately NOT deduped: `getUncataloguedRotationFromDB`'s own doc
 * comment states two physically distinct promos sharing an artist and title
 * are two separate rows a librarian has to catalogue, and collapsing them
 * would re-hide one (the exact bug its own DISTINCT ON removal fixed for
 * this endpoint).
 *
 * Backend serves at most one page per request, sorted most-recently-added
 * first; this reads that single page rather than walking every page, and
 * says so whenever the page comes back full. The backlog runs to thousands
 * of rows against a page of 500, and a truncated queue that does not
 * announce itself reads as a finished one -- the `MissingReleases`
 * precedent for the same situation.
 */
function UncataloguedFacet({
  onKill,
  onUnkill,
  pendingRotationIds,
}: {
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  pendingRotationIds: ReadonlySet<number>;
}) {
  const [showKilled, setShowKilled] = useState(false);
  const { data, isLoading, isFetching, isError, refetch } = useGetUncataloguedRotationQuery({
    limit: UNCATALOGUED_ROTATION_PAGE_SIZE,
  });

  const hasNothingToShow = isError && data == null;

  if (isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;
  if (hasNothingToShow) return <OutagePanel onRetry={refetch} retrying={isFetching} />;

  const page = data ?? [];
  const allRows = page.map((row) => toDisplayRowFromUncatalogued(row));
  const rows = showKilled ? allRows : allRows.filter((row) => row.active);
  // A full page is indistinguishable from a complete backlog, so it is
  // reported as what it is. The backlog runs to thousands of rows against a
  // 500-row cap, and a silently truncated queue reads as a finished one.
  const isTruncated = page.length >= UNCATALOGUED_ROTATION_PAGE_SIZE;

  return (
    <>
      <p style={{ textAlign: "center" }}>
        <label>
          <input
            type="checkbox"
            checked={showKilled}
            onChange={(e) => setShowKilled(e.target.checked)}
          />
          &nbsp;Show killed releases too (the cataloging backlog)
        </label>
      </p>
      {isTruncated && (
        <p className="live-results-empty" style={{ textAlign: "center" }}>
          This queue is drawn from the {page.length} most recently added releases awaiting cataloging
          &mdash; the rotation API serves at most that many per request, so older entries in the backlog
          are not listed here.
        </p>
      )}
      <RotationTable rows={rows} onKill={onKill} onUnkill={onUnkill} pendingRotationIds={pendingRotationIds} />
    </>
  );
}

/**
 * "All" and "Killed" render this instead of a table: Backend has no read
 * path for a catalogued rotation row that has been killed.
 * `getRotationFromDB` (`GET /library/rotation`) restricts itself to active
 * rows via its own `WHERE kill_date IS NULL OR kill_date > CURRENT_DATE`,
 * and `getUncataloguedRotationFromDB` (`GET /library/rotation/uncatalogued`)
 * answers every status but only for `album_id IS NULL` rows. Between them
 * there is no query that returns a catalogued, killed rotation row -- so
 * these two JSP facets cannot be built against the current contract without
 * fabricating a partial answer and presenting it as complete, which the
 * outage-rendering convention this screen otherwise follows forbids doing
 * silently. Rather than hide the chips (a JSP facet with no equivalent
 * button at all would be its own, less honest, divergence), they render and
 * say so.
 */
function UnavailableFacet() {
  return (
    <p className="live-results-empty" style={{ textAlign: "center" }}>
      This filter needs data Backend-Service doesn&apos;t expose yet: there is no endpoint for a
      catalogued rotation release that has been killed. The Awaiting Cataloging facet&apos;s
      &quot;Show killed releases too&quot; toggle covers the uncatalogued half of this backlog.
    </p>
  );
}

/**
 * Reproduces `rotationReleaseList.jsp` -- see the module-level facet
 * components above for how each of the JSP's four facets maps onto
 * Backend's actual read surface, and `lib/features/rotation/classicList.ts`
 * for the unlinked-id check and the active/killed date logic shared with
 * the free-text add screen.
 *
 * Three more divergences, none forced by the Backend contract:
 *
 * - "Main Menu" carries the JSP's own label but points at `/dashboard/
 *   catalog` -- dj-site's classic catalog search, the DJ-facing entry point
 *   `searchCardCatalog` names in tubafrenzy. There is no dj-site route named
 *   after the servlet path itself.
 * - "Format Tallysheets" is dropped entirely, matching `MissingReleases`'
 *   precedent for a JSP link with no dj-site destination: no tallysheet
 *   screen exists here, so the alternative would be a dead link rather than
 *   a working one under a different name.
 * - The row's "Edit" and "Import" links are dropped for the same reason.
 *   Their destinations (`/dashboard/rotation/[id]` and
 *   `/dashboard/rotation/[id]/import` in `docs/architecture.md`'s URL map)
 *   are later slices, and no route answers either path today, so rendering
 *   them would put a 404 under every row -- and under the exact affordance
 *   the catalog chooser's "Import a killed rotation release into the
 *   library" block funnels a librarian toward. Kill and Unkill stay: both
 *   act in place through endpoints that exist.
 */
export default function RotationReleaseList({ statusFilter }: { statusFilter: RotationStatusFilter }) {
  const [killRotationEntry] = useKillRotationEntryMutation();
  const [unkillRotationEntry] = useUnkillRotationEntryMutation();
  const [pendingRotationIds, setPendingRotationIds] = useState<ReadonlySet<number>>(() => new Set());

  const withPending = async (rotationId: number, run: () => Promise<unknown>, failureVerb: string) => {
    setPendingRotationIds((prev) => new Set(prev).add(rotationId));
    try {
      await run();
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error(`Couldn't ${failureVerb} this rotation release. Please try again.`);
      }
    } finally {
      setPendingRotationIds((prev) => {
        const next = new Set(prev);
        next.delete(rotationId);
        return next;
      });
    }
  };

  const handleKill = (rotationId: number) =>
    withPending(rotationId, () => killRotationEntry({ rotation_id: rotationId }).unwrap(), "kill");
  const handleUnkill = (rotationId: number) =>
    withPending(rotationId, () => unkillRotationEntry({ rotation_id: rotationId }).unwrap(), "unkill");

  return (
    <div>
      <div className="label" style={{ textAlign: "center", padding: "10px 0" }}>
        <Link href="/dashboard/rotation/new">Add Rotation Release</Link>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <Link href="/dashboard/catalog">Main Menu</Link>
      </div>

      <h3 style={{ textAlign: "center", margin: "5px 0 15px 0" }}>Rotation Releases</h3>

      <div style={{ textAlign: "center", marginBottom: 15 }}>
        <div className="facet-bar">
          {FACETS.map((facet) => (
            <Link
              key={facet.value}
              href={facetHref(facet.value)}
              className={`facet-chip${statusFilter === facet.value ? " active" : ""}`}
              aria-current={statusFilter === facet.value ? "page" : undefined}
            >
              {facet.label}
            </Link>
          ))}
        </div>
      </div>

      {statusFilter === "active" && (
        <ActiveFacet onKill={handleKill} onUnkill={handleUnkill} pendingRotationIds={pendingRotationIds} />
      )}
      {statusFilter === "uncataloged" && (
        <UncataloguedFacet onKill={handleKill} onUnkill={handleUnkill} pendingRotationIds={pendingRotationIds} />
      )}
      {(statusFilter === "all" || statusFilter === "killed") && <UnavailableFacet />}
    </div>
  );
}
