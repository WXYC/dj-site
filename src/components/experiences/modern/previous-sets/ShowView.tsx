"use client";

import Link from "next/link";
import { Box, Sheet, Typography } from "@mui/joy";
import { useShowPlaylist } from "@/src/hooks/showPlaylistHooks";
import ShowEntriesPanel from "@/src/components/experiences/modern/schedule-week/ShowEntriesPanel";

/**
 * One archived show, reached by navigating to it rather than by expanding it
 * under the calendar.
 *
 * The week link is derived from the show's own `start_time`, not from whatever
 * week the visitor arrived through, so it cannot carry an id belonging to a
 * different week.
 */
export default function ShowView({ showId }: { showId: number }) {
  const show = useShowPlaylist(showId);

  if (show.notFound) {
    return (
      <Sheet variant="outlined" sx={{ borderRadius: "md", p: 3, mt: 2 }}>
        <Typography level="title-md">No show with that id</Typography>
        <Typography level="body-sm" sx={{ mt: 1, color: "text.secondary" }}>
          It may have been removed.
        </Typography>
        <Typography level="body-sm" sx={{ mt: 2 }}>
          <Link href="?view=week">Back to the weekly view</Link>
        </Typography>
      </Sheet>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Sheet
        variant="soft"
        sx={{
          borderRadius: "md",
          px: 2,
          py: 1.5,
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography level="title-lg" component="h2">
            {show.title}
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {show.day} · {show.timeRange}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2, alignItems: "baseline" }}>
          {show.djName && (
            <Typography level="body-sm">Disc Jockey: {show.djName}</Typography>
          )}
          <Typography level="body-sm">
            <Link href={`?view=week&week=${show.weekParam}`}>Weekly view</Link>
          </Typography>
        </Box>
      </Sheet>

      <ShowEntriesPanel
        show={{ id: showId, show_name: show.title, dj_name: show.djName } as never}
        entries={show.entries}
        isPartial={false}
        partialEdge={null}
        isLoading={show.isLoading}
      />
    </Box>
  );
}
