"use client";

import { useMarkFoundMutation } from "@/lib/features/catalog/api";
import { useMissingReleases } from "@/src/hooks/catalogHooks";

function formatMissingSince(dateLost: string | null | undefined): string {
  if (!dateLost) return "Unknown";
  return new Date(dateLost).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

// Xeroxed from missingReleases.jsp. Two fields link out in the JSP
// (artist -> artistCardModify.jsp, title -> libraryReleaseModify.jsp) —
// dj-site's librarian artist/release detail screens are a later slice of
// this same epic (docs/architecture.md's `/dashboard/library/*` rows), so
// those cells render as plain text here rather than as dead links. The
// admin-only "Create or Find Artists By Library Code" link is dropped for
// the same reason.
export default function MissingReleases() {
  const { results, total, isLoading, isError } = useMissingReleases();
  const [markFound] = useMarkFoundMutation();

  return (
    <div style={{ textAlign: "center" }}>
      <table cellPadding={4} border={0} width="100%" style={{ borderSpacing: 1 }}>
        <tbody>
          <tr style={{ textAlign: "center" }}>
            <td className="title">Missing Releases</td>
          </tr>
          <tr style={{ backgroundColor: "#F3F3F3" }}>
            <td className="subtitle">
              <b>Total missing: {total}</b>
            </td>
          </tr>
          <tr>
            <td className="text">
              <a href="/dashboard/catalog">
                <b>Search Card Catalog</b>
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      {isError ? (
        <p className="text">Error loading missing releases. Please try again.</p>
      ) : isLoading ? (
        <p className="text">Loading...</p>
      ) : results.length === 0 ? (
        <p className="text">There are currently no missing releases.</p>
      ) : (
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
            {results.map((release, index) => (
              <tr
                key={release.id}
                className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}
              >
                <td style={{ textAlign: "center" }}>{release.format}</td>
                <td style={{ textAlign: "right" }}>{release.artist?.genre ?? "Unknown"}</td>
                <td style={{ textAlign: "left" }}>
                  {release.artist?.lettercode} {release.artist?.numbercode}/{release.entry}
                </td>
                <td style={{ textAlign: "left" }}>
                  {release.album_artist ? "Various Artists" : release.artist?.name ?? "Unknown"}
                </td>
                <td style={{ textAlign: "left" }}>{release.title}</td>
                <td style={{ textAlign: "center" }}>{formatMissingSince(release.date_lost)}</td>
                <td style={{ textAlign: "center" }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      markFound({ albumId: release.id! });
                    }}
                  >
                    Mark as Found
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
