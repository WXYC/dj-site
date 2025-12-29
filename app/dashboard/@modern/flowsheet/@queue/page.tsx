"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/modern/flowsheet/Entries/SongEntry/SongEntry";
import { Box, Stack } from "@mui/joy";
import { Reorder } from "motion/react";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useCallback, useEffect, useState } from "react";

export default function Queue() {
  const queue = useAppSelector((state) => state.flowsheet.queue);
  const dispatch = useAppDispatch();
  const [isMounted, setIsMounted] = useState(false);

  // Only render queue content after client-side mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handler for reordering queue items - Disabled for now
  const handleReorder = useCallback((newOrder: typeof queue) => {
    // Reordering disabled
  }, []);

  return (
    <Stack spacing={0.5}>
      <Reorder.Group
        values={isMounted ? queue.toReversed() : []}
        axis="y"
        onReorder={handleReorder}
        as="div"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        {isMounted && queue.toReversed().map((entry) => (
          <SongEntry
            key={`queue-${entry.id}`}
            entry={entry}
            playing={false}
            queue={true}
          />
        ))}
      </Reorder.Group>
    </Stack>
  );
}
