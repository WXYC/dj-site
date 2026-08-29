"use client";

import { Box, CircularProgress, Sheet, Table, Typography } from "@mui/joy";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import { STATION_TIME_ZONE } from "@/src/utilities/stationTime";
import { SHOW_PANEL_ID } from "./ShowBlock";

const timeOf = (entry: FlowsheetRangeEntry) => {
  // A breakpoint is logged roughly a minute before the hour it marks, so its
  // own add_time reads an hour early. radio_hour is the hour it stands for.
  const source =
    entry.entry_type === "breakpoint" && entry.radio_hour != null
      ? new Date(entry.radio_hour)
      : entry.add_time
        ? new Date(entry.add_time)
        : null;
  if (!source || Number.isNaN(source.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(source);
};

export default function ShowEntriesPanel({
  show,
  entries,
  isPartial,
  isLoading,
}: {
  show: FlowsheetRangeShow;
  entries: FlowsheetRangeEntry[];
  isPartial: boolean;
  isLoading: boolean;
}) {
  return (
    <Sheet
      id={SHOW_PANEL_ID}
      variant="outlined"
      sx={{ mt: 2, borderRadius: "md", p: 2 }}
    >
      <Typography level="title-md" component="h3">
        {show.show_name ?? show.dj_name ?? "Unattributed show"}
      </Typography>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size="sm" />
        </Box>
      )}

      {isPartial && (
        <Typography level="body-sm" color="warning" sx={{ mt: 1 }}>
          Showing the {entries.length} entries logged during this week. This show
          began before the week started, and the rest are in the previous week.
        </Typography>
      )}

      {!isLoading && entries.length === 0 && (
        <Typography level="body-sm" sx={{ mt: 1, color: "text.secondary" }}>
          No entries recorded for this show.
        </Typography>
      )}

      {entries.length > 0 && (
        <Box sx={{ maxHeight: "20rem", overflowY: "auto", mt: 1 }}>
          <Table size="sm" stickyHeader aria-label="show entries">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Time</th>
                <th style={{ width: "30%" }}>Artist</th>
                <th style={{ width: "30%" }}>Song</th>
                <th>Release</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                      {timeOf(entry)}
                    </Typography>
                  </td>
                  {entry.entry_type && entry.entry_type !== "track" ? (
                    <td colSpan={3}>
                      <Typography level="body-xs" sx={{ fontStyle: "italic" }}>
                        {entry.message ?? entry.entry_type}
                      </Typography>
                    </td>
                  ) : (
                    <>
                      <td>
                        <Typography level="body-sm">{entry.artist_name}</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">{entry.track_title}</Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                          {entry.album_title}
                        </Typography>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      )}
    </Sheet>
  );
}
