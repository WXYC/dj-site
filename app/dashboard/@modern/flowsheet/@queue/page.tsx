"use client";

import { useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/modern/flowsheet/Entries/SongEntry/SongEntry";
import { Stack } from "@mui/joy";

export default function Queue() {
  const queue = useAppSelector((state) => state.flowsheet.queue);

  return (
    <Stack direction="column" spacing={1}>
      {queue.toReversed().map((entry) => (
        <SongEntry
          key={`queue-${entry.id}`}
          entry={entry}
          playing={false}
          queue={true}
        />
      ))}
    </Stack>
  );
}
