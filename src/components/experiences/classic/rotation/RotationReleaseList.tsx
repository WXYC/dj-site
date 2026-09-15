"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import {
  useGetRotationListQuery,
  useGetUncataloguedRotationQuery,
} from "@/lib/features/rotation/api";
import {
  byMostRecentlyAdded,
  dedupeRotationListByArtistTitle,
  toDisplayRowFromList,
  toDisplayRowFromUncatalogued,
  type RotationDisplayRow,
} from "@/lib/features/rotation/classicList";
import { useRotationRowActions } from "@/lib/features/rotation/hooks";
import {
  ROTATION_STATUS_FACET_RENDER_BATCH,
  UNCATALOGUED_ROTATION_PAGE_SIZE,
  type RotationListStatusFilter,
  type RotationStatusFilter,
} from "@/lib/features/rotation/types";

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
 * The table body shared by every facet that has real rows to show (Active,
 * Awaiting Cataloging). Column set and order match `rotationReleaseList.jsp`
 * exactly when `canWrite` is true: Actions, Artist, Title, Label, Type,
 * Format, Added, Killed, Library -- nine columns. A DJ (`canWrite` false)
 * gets the eight read-only columns with the Actions column -- header cell
 * included -- dropped rather than rendered empty, since Backend refuses
 * every write it could offer him anyway.
 *
 * Kill/Unkill, the Killed column and the Library column all key on whether
 * the row carries a kill date at all, never on whether that date has
 * arrived -- `release.killDate == 0` is the JSP's own test. A kill dated
 * next week leaves the row in rotation today and is still a kill, so it
 * shows its date and offers Unkill.
 */
function RotationTable({
  rows,
  canWrite,
  onKill,
  onUnkill,
  pendingRotationIds,
}: {
  rows: RotationDisplayRow[];
  canWrite: boolean;
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  pendingRotationIds: ReadonlySet<number>;
}) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <table className="entry-table" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <thead>
        <tr className="entry-header">
          {canWrite && <th style={{ textAlign: "center" }}>Actions</th>}
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
              {canWrite && (
                <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                  <Link href={`/dashboard/rotation/${row.rotationId}`} aria-label={`Edit: ${row.title}`}>
                    Edit
                  </Link>
                  &nbsp;
                  {/* Named per row, matching `MissingReleases`: a table of up to
                      500 buttons all reading "Kill" tells a screen-reader user
                      nothing about which release they are about to act on. */}
                  {row.killedDisplay == null ? (
                    <button
                      type="button"
                      className="link-button"
                      disabled={pending}
                      aria-label={`Kill: ${row.title}`}
                      onClick={() => onKill(row.rotationId)}
                    >
                      Kill
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      disabled={pending}
                      aria-label={`Unkill: ${row.title}`}
                      onClick={() => onUnkill(row.rotationId)}
                    >
                      Unkill
                    </button>
                  )}
                  {/* The JSP's own condition for this link, spelled as the
                      Library column's verdict: a killed row that never linked.
                      A row still in rotation has not been through a cataloging
                      decision yet, and a linked one has nothing to import. */}
                  {row.libraryStatus === "uncataloged" && (
                    <>
                      &nbsp;
                      <Link
                        href={`/dashboard/rotation/${row.rotationId}/import`}
                        aria-label={`Import: ${row.title}`}
                        style={{ color: "#CC0000", fontWeight: "bold" }}
                      >
                        Import
                      </Link>
                    </>
                  )}
                </td>
              )}
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
  canWrite,
  onKill,
  onUnkill,
  pendingRotationIds,
}: {
  canWrite: boolean;
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  pendingRotationIds: ReadonlySet<number>;
}) {
  const { data, isLoading, isFetching, isError, refetch } = useGetRotationListQuery("active");

  // Absence-of-list, not the error flag: a background refetch can leave
  // isError true while the last-good rows are still on screen, and a
  // request that never went out reports neither.
  const hasNothingToShow = isError && data == null;

  if (isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;
  if (hasNothingToShow) return <OutagePanel onRetry={refetch} retrying={isFetching} />;

  const rows = dedupeRotationListByArtistTitle(data ?? []).map((row) => toDisplayRowFromList(row));
  return (
    <RotationTable
      rows={rows}
      canWrite={canWrite}
      onKill={onKill}
      onUnkill={onUnkill}
      pendingRotationIds={pendingRotationIds}
    />
  );
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
  canWrite,
  onKill,
  onUnkill,
  pendingRotationIds,
}: {
  canWrite: boolean;
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  pendingRotationIds: ReadonlySet<number>;
}) {
  const [showKilled, setShowKilled] = useState(false);
  const { data, isLoading, isFetching, isError, refetch } = useGetUncataloguedRotationQuery({
    limit: UNCATALOGUED_ROTATION_PAGE_SIZE,
  });
  // The queue read carries `format_id` and no name -- the rotation row's own
  // pre-catalog field, published without a join -- so the Format column
  // resolves against the catalog's own formats list. A row whose format this
  // cannot name keeps the em dash rather than showing an id.
  const { data: formats } = useGetFormatsQuery();
  const formatNames = useMemo(
    () => new Map((formats ?? []).map((format) => [format.id, format.format_name])),
    [formats],
  );

  const hasNothingToShow = isError && data == null;

  if (isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;
  if (hasNothingToShow) return <OutagePanel onRetry={refetch} retrying={isFetching} />;

  const page = data ?? [];
  const allRows = page.map((row) => toDisplayRowFromUncatalogued(row, formatNames));
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
      <RotationTable
        rows={rows}
        canWrite={canWrite}
        onKill={onKill}
        onUnkill={onUnkill}
        pendingRotationIds={pendingRotationIds}
      />
    </>
  );
}

/**
 * The All and Killed facets: `GET /library/rotation?status=`. The same
 * endpoint the Active facet reads, which answers `active` by default and is
 * the only read that returns a rotation row that is both catalogued and
 * killed -- the Awaiting Cataloging queue answers every kill state but only
 * for rows that never linked to a library release.
 *
 * Deliberately NOT deduped, unlike the Active facet. `getRotationFromDB`
 * collapses same-(album, bin) duplicates for `status=active` alone, because
 * that shape feeds a dropdown; `killed` and `all` are served uncollapsed on
 * purpose. A release that was re-added, re-binned or promoted again over the
 * years is that many separate rotation facts, each with its own kill date and
 * its own Unkill, so collapsing them here would hide history and offer Unkill
 * on a row the librarian did not mean.
 *
 * Sorted here rather than trusted from the response, for the reason the
 * Active facet sorts: the order is `rotationReleaseList.jsp`'s own, and
 * owning it keeps all four facets ordered alike however any one endpoint
 * happens to return its rows.
 */
function StatusFacet({
  status,
  canWrite,
  onKill,
  onUnkill,
  pendingRotationIds,
}: {
  status: RotationListStatusFilter;
  canWrite: boolean;
  onKill: (rotationId: number) => void;
  onUnkill: (rotationId: number) => void;
  pendingRotationIds: ReadonlySet<number>;
}) {
  const [renderCap, setRenderCap] = useState(ROTATION_STATUS_FACET_RENDER_BATCH);
  const { data, isLoading, isFetching, isError, refetch } = useGetRotationListQuery(status);

  // Absence-of-list, not the error flag, for the reason the Active facet
  // gives: a background refetch can leave isError true with the last-good
  // rows still on screen.
  const hasNothingToShow = isError && data == null;

  if (isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;
  if (hasNothingToShow) return <OutagePanel onRetry={refetch} retrying={isFetching} />;

  const history = [...(data ?? [])].sort(byMostRecentlyAdded);
  const rows = history.slice(0, renderCap).map((row) => toDisplayRowFromList(row));
  const remaining = history.length - rows.length;

  return (
    <>
      <RotationTable
        rows={rows}
        canWrite={canWrite}
        onKill={onKill}
        onUnkill={onUnkill}
        pendingRotationIds={pendingRotationIds}
      />
      {remaining > 0 && (
        <p className="live-results-empty" style={{ textAlign: "center" }}>
          Showing {rows.length} of {history.length} rotation releases.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => setRenderCap((cap) => cap + ROTATION_STATUS_FACET_RENDER_BATCH)}
          >
            Show {Math.min(ROTATION_STATUS_FACET_RENDER_BATCH, remaining)} more
          </button>
        </p>
      )}
    </>
  );
}

/**
 * Reproduces `rotationReleaseList.jsp` -- see the module-level facet
 * components above for how each of the JSP's four facets maps onto
 * Backend's actual read surface, and `lib/features/rotation/classicList.ts`
 * for the unlinked-id check and the active/killed date logic shared with
 * the free-text add screen.
 *
 * Four divergences from the JSP, the third forced by the Backend contract:
 *
 * - "Main Menu" carries the JSP's own label but points at `/dashboard/
 *   catalog` -- dj-site's classic catalog search, the DJ-facing entry point
 *   `searchCardCatalog` names in tubafrenzy. `/dashboard/md` now serves the
 *   menu itself, but it is MD-gated while this screen is DJ-accessible, so
 *   pointing "Main Menu" there would bounce a DJ off the menu it just
 *   offered him.
 * - "Format Tallysheets" carries the JSP's label to the weekly summary. That
 *   screen compiles its figures from the flowsheet on read rather than from
 *   stored, hand-corrected counts, so it is the JSP's report without the
 *   sheet the music director edited first.
 * - Edit, Import, Kill, Unkill and the header's "Add Rotation Release" link
 *   are the JSP's own write affordances, each with a destination or an
 *   endpoint behind it, but `mainmenu.jsp` never gated any of them --
 *   Backend does, at `catalog: ['write']`, and the station librarian asked
 *   for the UI to agree rather than keep offering a DJ five controls that
 *   always 403. `canWrite` -- resolved once, server-side, in
 *   `app/dashboard/@classic/rotation/page.tsx`, and required here rather
 *   than defaulted -- hides all five for a DJ; an MD sees the screen
 *   unchanged. Edit is still offered on every row an MD can reach, including
 *   a catalogued one: the two dates stay writable there even though the
 *   release's artist, title, label and format do not.
 * - The JSP prints every row of every facet. All and Killed are the whole
 *   rotation history here, so they mount in batches with the full count
 *   beside the control that reveals the next one -- a render cap, never a
 *   filter, and never a count that could be mistaken for the whole set.
 */
export default function RotationReleaseList({
  statusFilter,
  canWrite,
}: {
  statusFilter: RotationStatusFilter;
  canWrite: boolean;
}) {
  const { pendingRotationIds, kill: handleKill, unkill: handleUnkill } = useRotationRowActions();

  return (
    <div>
      <div className="label" style={{ textAlign: "center", padding: "10px 0" }}>
        {canWrite && (
          <>
            <Link href="/dashboard/rotation/new">Add Rotation Release</Link>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          </>
        )}
        <Link href="/dashboard/rotation/tallysheet">Format Tallysheets</Link>
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
        <ActiveFacet
          canWrite={canWrite}
          onKill={handleKill}
          onUnkill={handleUnkill}
          pendingRotationIds={pendingRotationIds}
        />
      )}
      {statusFilter === "uncataloged" && (
        <UncataloguedFacet
          canWrite={canWrite}
          onKill={handleKill}
          onUnkill={handleUnkill}
          pendingRotationIds={pendingRotationIds}
        />
      )}
      {(statusFilter === "all" || statusFilter === "killed") && (
        // Keyed so switching facets restarts the render cap rather than
        // carrying one facet's expanded view into the other.
        <StatusFacet
          key={statusFilter}
          status={statusFilter}
          canWrite={canWrite}
          onKill={handleKill}
          onUnkill={handleUnkill}
          pendingRotationIds={pendingRotationIds}
        />
      )}
    </div>
  );
}
