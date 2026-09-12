"use client";

import Link from "next/link";
import { useId } from "react";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import { useGetRotationRowQuery } from "@/lib/features/rotation/api";
import { formatRotationDate } from "@/lib/features/rotation/classicList";
import { ROTATION_BIN_LABELS } from "@/lib/features/rotation/types";

const IMPORT_QUEUE_HREF = "/dashboard/rotation?status=uncataloged";

function ImportNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
      {children}
    </p>
  );
}

/**
 * Reproduces `rotationReleaseImport.jsp`'s header: the two navigation links,
 * the heading, and the Rotation Release summary table the JSP renders above
 * every branch of the screen.
 *
 * Two divergences from the JSP, neither in layout:
 *
 * - The summary's label column is `<th scope="row">` where the JSP uses a
 *   bolded `<td>`. Same rendering, and it is what makes each value announce
 *   with the field it belongs to.
 * - Format shows a name resolved client-side from the formats list, and shows
 *   nothing when that list cannot name it. The rotation row carries
 *   `format_id` and no name: the read is join-free by design, because these
 *   are the row's own pre-catalog fields rather than a linked release's, and
 *   printing the raw id would read as a format called "3".
 */
export default function RotationImportScreen({ rotationId }: { rotationId: number }) {
  const summaryHeadingId = useId();
  const { data: row, isLoading, isError, error } = useGetRotationRowQuery(rotationId);
  const { data: formats } = useGetFormatsQuery();

  const body = () => {
    if (isLoading) return <p style={{ textAlign: "center" }}>Loading...</p>;

    // Absence-of-row, not the error flag: a background refetch can leave
    // isError true while the last-good row is still on screen.
    if (row == null) {
      const status = isError ? (error as { status?: unknown } | undefined)?.status : undefined;
      return (
        <ImportNotice>
          {status === 404
            ? "This rotation release is no longer in the queue."
            : "This rotation release is unavailable right now."}
        </ImportNotice>
      );
    }

    // A linked row has nothing left to import, and offering the form anyway
    // is how a second library release gets minted for a release someone has
    // already catalogued.
    if (row.album_id != null) {
      return (
        <ImportNotice>
          This rotation release has already been catalogued.{" "}
          <Link href={IMPORT_QUEUE_HREF}>Back to Import Queue</Link>
        </ImportNotice>
      );
    }

    const formatName = formats?.find((format) => format.id === row.format_id)?.format_name ?? "";

    return (
      <table
        className="entry-table"
        style={{ maxWidth: 500, margin: "0 auto" }}
        aria-labelledby={summaryHeadingId}
      >
        <tbody>
          <tr className="entry-header">
            <th colSpan={2} id={summaryHeadingId} style={{ textAlign: "center" }}>
              Rotation Release
            </th>
          </tr>
          {(
            [
              ["Artist:", row.artist_name ?? ""],
              ["Title:", row.album_title ?? ""],
              ["Label:", row.record_label ?? ""],
              ["Format:", formatName],
              ["Rotation:", ROTATION_BIN_LABELS[row.rotation_bin]],
              ["Added:", formatRotationDate(row.add_date)],
              ["Killed:", formatRotationDate(row.kill_date)],
            ] as const
          ).map(([label, value], index) => (
            <tr key={label} className={`entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`}>
              <th scope="row" style={{ textAlign: "right", width: 100 }}>
                {label}
              </th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div className="label" style={{ textAlign: "center", padding: "10px 0" }}>
        <Link href={IMPORT_QUEUE_HREF}>Back to Import Queue</Link>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <Link href="/dashboard/rotation">All Rotation Releases</Link>
      </div>

      <h3 style={{ textAlign: "center", margin: "5px 0 15px 0" }}>Import Rotation Release to Library</h3>

      {body()}
    </div>
  );
}
