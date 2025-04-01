"use client";

import { useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/modern/flowsheet/Entries/SongEntry/SongEntry";
import { Table, useColorScheme } from "@mui/joy";

export default function Queue() {
  const { mode } = useColorScheme();
  const queue = useAppSelector((state) => state.flowsheet.queue);

  return (
    <Table borderAxis={mode == "dark" ? "x" : "x"} variant="soft">
      <thead
        style={{
          visibility: "collapse",
        }}
      >
        <tr>
          <td
            style={{
              width: "60px",
            }}
          ></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </thead>
      <tbody>
        {queue.toReversed().map((entry) => (
          <SongEntry
            key={`queue-${entry.id}`}
            entry={entry}
            playing={false}
            queue={true}
          />
        ))}
      </tbody>
    </Table>
  );
}
