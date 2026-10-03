"use client";

import { CircularProgress, Stack, Table, Typography } from "@mui/joy";
import { hrefForShowEntry } from "@/lib/features/schedule-week/showUrl";
import type { ArchiveStreamListing } from "@/src/hooks/archiveStreamHooks";
import ReadOnlyEntry from "@/src/components/experiences/modern/flowsheet/Entries/ReadOnly/ReadOnlyEntry";
import {
  FLOWSHEET_TABLE_SX,
  FlowsheetColumnSizingRow,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import FailedSearchNotice from "./FailedSearchNotice";

/**
 * The archive stream as the flowsheet's chronological table, one read-only row
 * per listing row. It takes the listing rather than calling the hook, so the
 * caller's scroller and this component's retry state read one listing.
 *
 * The status states render after the table, never inside it: the columns come
 * from one shared contract, and a full-width row would need a literal colSpan.
 * It renders no scrollport and no sentinel, and never calls `loadNextPage`.
 *
 * `playing` is always false. A playing row's cells carry a `clip-path` that
 * would confine a row link's overlay to the Time cell.
 */
export default function ArchiveStreamTable({
  listing,
  albumInfo = false,
  rowLinks = false,
}: {
  listing: ArchiveStreamListing;
  /** Shows the album-information control on song rows. */
  albumInfo?: boolean;
  /** Links each playcut's Time cell to its show. */
  rowLinks?: boolean;
}) {
  const { rows, isHeadLoading, isNextPageLoading, failedPage, isRetrying, hasMore, hasAnswered } =
    listing;

  return (
    <>
      <Table borderAxis="none" sx={FLOWSHEET_TABLE_SX} aria-label="playlist archive">
        <thead style={{ visibility: "collapse" }}>
          <FlowsheetColumnSizingRow leadingTimeColumn />
        </thead>
        <tbody>
          {rows.map((row) => (
            <ReadOnlyEntry
              key={row.id}
              entry={row.entry}
              playing={false}
              timeLabel={row.timeLabel}
              albumInfo={albumInfo}
              showHref={rowLinks && row.showId !== null ? hrefForShowEntry(row.showId, row.id) : null}
            />
          ))}
        </tbody>
      </Table>
      {isHeadLoading && !isRetrying && rows.length === 0 && (
        <Stack alignItems="center" sx={{ pt: 6 }}>
          <CircularProgress size="md" />
        </Stack>
      )}
      {isNextPageLoading && !isRetrying && (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size="sm" />
        </Stack>
      )}
      {failedPage !== null && (
        <Stack alignItems="center" sx={{ pt: 4 }}>
          <FailedSearchNotice
            onRetry={listing.retry}
            retrying={isRetrying}
            failedRetries={listing.failedRetries}
          />
        </Stack>
      )}
      {hasAnswered && !hasMore && failedPage === null && (
        <Typography level="body-xs" textAlign="center" sx={{ py: 2 }}>
          Beginning of the archive
        </Typography>
      )}
    </>
  );
}
