"use client";

import { Typography } from "@mui/joy";

/**
 * The leading Time cell of an archive drill-in row.
 *
 * The live flowsheet has no per-row time — its markers carry their own, inside
 * the row — so this is the 7th column unit that `FlowsheetColumnSizingRow`'s
 * `leadingTimeColumn` variant sizes. A row renders it exactly when it is given
 * a `timeLabel`, and the sizing row must be switched on with it.
 */
export default function EntryTimeCell({ label }: { label: string }) {
  return (
    <td className="col-time">
      <Typography level="body-xs" textColor="text.tertiary">
        {label}
      </Typography>
    </td>
  );
}
