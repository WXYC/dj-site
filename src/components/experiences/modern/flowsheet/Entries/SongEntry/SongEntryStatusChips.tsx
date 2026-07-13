"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { WXYC_EXCLUSIVE_PURPLE } from "@/src/utilities/modern/brandColors";
import { ROTATION_TONES } from "@/lib/features/experiences/modern/tokens/roles";
import { Chip } from "@mui/joy";

// Caption-scale status pills, matching the catalog table's chip language.
export const STATUS_CHIP_SX = {
  fontSize: "0.65rem",
  fontWeight: 500,
  "--Chip-minHeight": "16px",
  "--Chip-paddingInline": "6px",
} as const;

// Read-only status pills for a song entry: rotation bin, WXYC exclusive, and
// (on non-editable rows, where the interactive checkboxes are hidden) the
// request / segue state.
export default function SongEntryStatusChips({
  entry,
  editable,
}: {
  entry: FlowsheetSongEntry;
  editable: boolean;
}) {
  return (
    <>
      {entry.rotation && (
        <Chip
          size="sm"
          variant="solid"
          color={ROTATION_TONES[entry.rotation].color}
          aria-label={`Rotation ${entry.rotation}`}
          sx={STATUS_CHIP_SX}
        >
          {entry.rotation}
        </Chip>
      )}
      {entry.on_streaming === false && (
        <Chip
          variant="soft"
          size="sm"
          sx={{
            ...STATUS_CHIP_SX,
            backgroundColor: WXYC_EXCLUSIVE_PURPLE,
            color: "#fff",
            letterSpacing: "0.5px",
          }}
        >
          EXCLUSIVE
        </Chip>
      )}
      {entry.request_flag && !editable && (
        <Chip size="sm" variant="soft" color="warning" sx={STATUS_CHIP_SX}>
          REQ
        </Chip>
      )}
      {entry.segue && !editable && (
        <Chip size="sm" variant="soft" color="neutral" sx={STATUS_CHIP_SX}>
          SEGUE
        </Chip>
      )}
    </>
  );
}
