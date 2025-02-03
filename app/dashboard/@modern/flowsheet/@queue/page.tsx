"use client";

import { useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/modern/flowsheet/Entries/SongEntry/SongEntry";

export default function Queue() {
  const queue = useAppSelector((state) => state.flowsheet.queue);

  return queue.map((entry) => (
    <SongEntry
      key={`queue-${entry.id}`}
      entry={entry}
      playing={false}
      queue={true}
    />
  ));
}
