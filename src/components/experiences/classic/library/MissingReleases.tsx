"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useMarkFoundMutation } from "@/lib/features/catalog/api";
import { CATALOG_QUERY_MAX_LIMIT } from "@/lib/features/catalog/constants";
import { hasLinkedAlbumId } from "@/lib/features/flowsheet/linkage";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { useMissingReleases } from "@/src/hooks/catalogHooks";

function formatMissingSince(dateLost: string | null | undefined): string {
  if (!dateLost) return "Unknown";
  return new Date(dateLost).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

// Xeroxed from missingReleases.jsp. Five deliberate divergences:
//
// - The JSP renders every missing release. `/library/query` rejects a `limit`
//   above CATALOG_QUERY_MAX_LIMIT outright, so one request carries at most
//   that many rows and this screen states the cap whenever the server's total
//   is larger. A silently capped list would read as a complete shelf.
// - Row order diverges and cannot be fixed from this client. The JSP's
//   LibraryReleaseService.getMissingReleases() orders by DATE_LOST descending
//   — most recently lost first. This screen sends no sort/order, so
//   `/library/query` applies its defaults (album ascending); the endpoint's
//   valid sort keys don't include one that maps to date_lost, so no request
//   shape can ask for the JSP's order. A client-side reorder of the fetched
//   rows was rejected: above the cap it would present a JSP-faithful order
//   over the wrong hundred rows, disguising which ones were selected rather
//   than disclosing the divergence.
// - Mark as Found runs the PATCH in place. The JSP navigates to
//   `libraryRelease?id=…&mode=markFound`, a screen that confirms the outcome;
//   here the row's own action cell carries the in-flight and failure states.
// - Two fields link out in the JSP (artist -> artistCardModify.jsp, title ->
//   libraryReleaseModify.jsp). dj-site's librarian artist/release detail
//   screens are a later slice (docs/architecture.md's `/dashboard/library/*`
//   rows), so those cells render as plain text rather than as dead links.
// - The admin-only "Create or Find Artists By Library Code" link is dropped
//   for the same reason.
export default function MissingReleases() {
  const { results, total, isLoading, isRefreshing, isError, isTruncated } =
    useMissingReleases();
  const [markFound] = useMarkFoundMutation();
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );

  const handleMarkFound = async (albumId: number, title: string) => {
    setPendingIds((prev) => new Set(prev).add(albumId));
    try {
      await markFound({ albumId }).unwrap();
    } catch (err) {
      // markFound's own onQueryStarted swallows its rejection, so this is the
      // only place a failed mark-found can reach the DJ standing at the
      // stacks. Gated so a rejection the shared rejected-query middleware
      // already toasted isn't reported to them twice.
      if (isUnmessagedHttpError(err)) {
        toast.error(`Couldn't mark "${title}" as found. Please try again.`);
      }
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(albumId);
        return next;
      });
    }
  };

  // A failed request keeps whatever rows RTK already delivered. Only when
  // there are none is there nothing to show — swapping a populated table for
  // an error paragraph would take the shelf list away from someone mid-search,
  // and the shared rejected-query middleware reports the failure either way.
  const hasNothingToShow = isError && results.length === 0;
  const totalIsKnown = !isLoading && !hasNothingToShow;

  return (
    <div style={{ textAlign: "center" }}>
      <table cellPadding={4} border={0} width="100%" style={{ borderSpacing: 1 }}>
        <tbody>
          <tr style={{ textAlign: "center" }}>
            <td className="title">Missing Releases</td>
          </tr>
          <tr style={{ backgroundColor: "#F3F3F3" }}>
            {/* A count is a claim about the stacks; there is none to make
                before the request has answered. */}
            <td className="subtitle">
              <b>Total missing: {totalIsKnown ? total : "—"}</b>
            </td>
          </tr>
          <tr>
            <td className="text">
              <Link href="/dashboard/catalog">
                <b>Search Card Catalog</b>
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      {isLoading ? (
        <p className="text">Loading...</p>
      ) : hasNothingToShow ? (
        <p className="text">Error loading missing releases. Please try again.</p>
      ) : results.length === 0 ? (
        <p className="text">There are currently no missing releases.</p>
      ) : (
        <>
          {isTruncated && (
            <p className="text">
              Showing the first {results.length} of {total} missing releases —
              the catalog API serves at most {CATALOG_QUERY_MAX_LIMIT} rows per
              request. Use{" "}
              <Link href="/dashboard/catalog">Search Card Catalog</Link> to
              reach a release that isn&apos;t listed here.
            </p>
          )}
          <table className="entry-table">
            <thead>
              <tr className="entry-header">
                <th style={{ textAlign: "center" }}>Format</th>
                <th colSpan={2} style={{ textAlign: "center" }}>
                  Library Code
                </th>
                <th style={{ textAlign: "left" }}>Artist Name</th>
                <th style={{ textAlign: "left" }}>Title</th>
                <th style={{ textAlign: "center" }}>Missing Since</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((release, index) => {
                // A row carrying no server-issued id is unactionable: the id
                // conversions synthesize for an unlinked row addresses a
                // different release, or none at all.
                const albumId = hasLinkedAlbumId(release.id) ? release.id : null;
                return (
                  <tr
                    key={release.id ?? `row-${index}`}
                    className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
                  >
                    <td style={{ textAlign: "center" }}>{release.format}</td>
                    <td style={{ textAlign: "right" }}>{release.artist?.genre ?? ""}</td>
                    <td style={{ textAlign: "left" }}>
                      {release.artist?.lettercode} {release.artist?.numbercode}/{release.entry}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      {release.album_artist
                        ? "Various Artists"
                        : release.artist?.name || "Unknown"}
                    </td>
                    <td style={{ textAlign: "left" }}>{release.title}</td>
                    <td style={{ textAlign: "center" }}>
                      {formatMissingSince(release.date_lost)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {albumId !== null && (
                        <button
                          type="button"
                          className="link-button"
                          // Every row's action is disabled while the list
                          // refetches: that refetch is what removes a row just
                          // marked found, and until it lands every row on
                          // screen is stale.
                          disabled={isRefreshing || pendingIds.has(albumId)}
                          aria-label={`Mark as Found: ${release.title}`}
                          onClick={() => handleMarkFound(albumId, release.title)}
                        >
                          Mark as Found
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
