"use client";

import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import MobileEntry from "@/src/components/experiences/modern/flowsheet/Entries/MobileEntry";
import FlowsheetSkeletonLoader from "@/src/components/experiences/modern/flowsheet/FlowsheetSkeletonLoader";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Box, Table } from "@mui/joy";
import { Reorder } from "motion/react";
import { useEffect, useState } from "react";

export default function FlowsheetEntries() {
  const {
    loading,
    entries: { current, setCurrentShowEntries, previous },
  } = useFlowsheet();

  // Pin SSR to the skeleton: `loading` derives from RTK Query + persisted
  // auth state that diverges between the server's first render (no session,
  // no query has fired) and the client's hydration (persisted Redux session
  // already populated). Without this guard the SSR returns <Stack> (skeleton)
  // while the client hydrates <Table>, tripping React's hydration check.
  // See WXYC/dj-site#562.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return <FlowsheetSkeletonLoader count={10} />;
  }

  return (
    <>
    <Table
      borderAxis="none"
      sx={{
        // Desktop only; below `sm` the stacked mobile card list takes over.
        display: { xs: "none", sm: "table" },
        // Broadcast-log softening: separated rounded rows on lifted
        // surfaces instead of hard gridlines over pure black.
        borderCollapse: "separate",
        borderSpacing: "0 4px",
        "--TableCell-paddingX": "12px",
        "& tbody tr > td": {
          backgroundColor: "var(--row-bg, transparent)",
          transition: "background-color 120ms",
        },
        // Ordinary play rows sit nearly flush and lift on hover; colored
        // rows (playing, markers) just brighten slightly.
        "& tbody tr.row-plain:hover > td": {
          backgroundColor: (theme) => theme.vars.palette.background.level1,
        },
        "& tbody tr:not(.row-plain):hover": { filter: "brightness(1.05)" },
        // The current play lifts off the log for depth and keeps its
        // controls available without hover.
        "& tbody tr.row-playing > td": {
          boxShadow: "0 6px 12px -4px rgba(0, 0, 0, 0.35)",
          // Keep only the downward shadow: side bleed draws seams between
          // the row's cells.
          clipPath: "inset(0 0 -12px 0)",
        },
        "& tbody tr.row-playing .row-actions > *": { opacity: 1 },
        "& tbody tr > td:first-of-type": {
          borderTopLeftRadius: "8px",
          borderBottomLeftRadius: "8px",
        },
        "& tbody tr > td:last-of-type": {
          borderTopRightRadius: "8px",
          borderBottomRightRadius: "8px",
        },
        // Controls stay quieter than the music identity: revealed on row
        // hover/focus on pointer devices, always visible on touch. A control
        // marked row-actions-persist (e.g. an activated request phone) stays
        // visible without hover.
        "@media (hover: hover)": {
          "& tbody tr .row-actions > :not(.row-actions-persist)": {
            opacity: 0,
            transition: "opacity 120ms",
          },
          "& tbody tr:hover .row-actions > *, & tbody tr:focus-within .row-actions > *":
            {
              opacity: 1,
            },
          // Legibility backdrop appears only while revealed, so the status
          // chips underneath stay visible at rest.
          "& tbody tr:hover .row-actions, & tbody tr:focus-within .row-actions":
            {
              background:
                "linear-gradient(to right, transparent, var(--row-bg) 18px)",
            },
        },
      }}
    >
      <thead
        style={{
          visibility: "collapse",
        }}
      >
        {/* Column sizing only (thead is collapsed): art+drag | title |
            artist | album | label | status+actions. Every row type must
            render exactly these 6 column units or fixed-layout sizing
            silently degrades. */}
        <tr>
          <td style={{ width: "60px" }}></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td style={{ width: "150px" }}></td>
        </tr>
      </thead>
      <Reorder.Group
        values={current}
        axis="y"
        onReorder={() => {}} // Disabled for now
        as="tbody"
      >
        {current.map((entry, index) => (
          <Entry key={entry.id} entry={entry} playing={index == 0} />
        ))}
        {previous.map((entry, index) => (
          <Entry
            key={entry.id}
            entry={entry}
            playing={index == 0 && current.length == 0}
          />
        ))}
      </Reorder.Group>
    </Table>

    {/* Mobile: stacked cards instead of the table. */}
    <Box
      sx={{
        display: { xs: "flex", sm: "none" },
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      {current.map((entry, index) => (
        <MobileEntry key={entry.id} entry={entry} playing={index == 0} />
      ))}
      {previous.map((entry, index) => (
        <MobileEntry
          key={entry.id}
          entry={entry}
          playing={index == 0 && current.length == 0}
        />
      ))}
    </Box>
    </>
  );
}
