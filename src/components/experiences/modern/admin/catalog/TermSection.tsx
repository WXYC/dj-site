"use client";

import type { JSX, ReactNode } from "react";
import { Box, Sheet, Skeleton, Stack, Table, Typography } from "@mui/joy";
import ReadRetryAlert from "@/src/components/experiences/modern/admin/ReadRetryAlert";
import StatusRegion from "@/src/components/experiences/modern/StatusRegion";
import { ROW_HEIGHT, recordTableSx, tabularNumsSx } from "@/src/utilities/modern/recordTableSx";

export type TermColumn = { label: string; width?: number; align?: "right" };

/**
 * One vocabulary the library files by (genres, formats): a titled sheet with
 * its composer row on top, acting as the table's header, over a table that
 * scrolls inside the sheet. Loading shows skeleton rows and an outage shows
 * only the retry — an unread list is never drawn as an empty one.
 */
export default function TermSection({
  title,
  noun,
  count,
  composer,
  columns,
  loading,
  failed,
  onRetry,
  empty,
  children,
}: {
  title: string;
  /** Singular, lowercase: "genre", "format". */
  noun: string;
  count: number | null;
  composer: ReactNode;
  columns: TermColumn[];
  loading: boolean;
  /** The read failed and there is nothing to show. */
  failed: boolean;
  onRetry: () => void;
  empty: string;
  children: ReactNode;
}): JSX.Element {
  const status = loading
    ? `Loading ${noun}s`
    : failed
      ? `Could not load the ${noun}s`
      : `${count ?? 0} ${noun}${count === 1 ? "" : "s"}`;

  return (
    <Sheet
      component="section"
      aria-label={title}
      variant="outlined"
      sx={{ borderRadius: "md", display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <StatusRegion message={status} />
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ px: 2, pt: 1.5 }}>
        <Typography level="title-md" component="h2">
          {title}
        </Typography>
        {count != null && (
          <Typography level="body-sm" textColor="text.tertiary" sx={tabularNumsSx}>
            {count}
          </Typography>
        )}
      </Stack>
      <Box sx={{ px: 2, pt: 1, pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        {composer}
      </Box>
      {failed ? (
        <Box sx={{ p: 2 }}>
          <ReadRetryAlert message={`Could not load the ${noun}s.`} onRetry={onRetry} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <Table
            stickyHeader
            hoverRow
            aria-label={title}
            aria-busy={loading}
            sx={{ ...recordTableSx(ROW_HEIGHT.marker), "& thead th": { height: 36 } }}
          >
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    style={{ width: column.width, textAlign: column.align ?? "left" }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="record-row">
                      {columns.map((column) => (
                        <td key={column.label}>
                          <Skeleton variant="text" level="body-sm" width="60%" />
                        </td>
                      ))}
                    </tr>
                  ))
                : children}
            </tbody>
          </Table>
          {!loading && count === 0 && (
            <Typography level="body-sm" textColor="text.tertiary" sx={{ px: 2, py: 3, textAlign: "center" }}>
              {empty}
            </Typography>
          )}
        </Box>
      )}
    </Sheet>
  );
}

/** Library terms read alphabetically, the way a shelf is labelled. */
export function byName<T>(name: (row: T) => string) {
  return (left: T, right: T) => name(left).localeCompare(name(right), undefined, { sensitivity: "base" });
}

/** Case- and whitespace-insensitive, so "jazz " is caught as "Jazz". */
export function sameTerm(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), undefined, { sensitivity: "accent" }) === 0;
}
