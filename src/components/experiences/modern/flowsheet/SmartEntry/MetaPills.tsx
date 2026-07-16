import { Box, Chip, Stack } from "@mui/joy";
import type { ColorPaletteProp } from "@mui/joy";
import type { ReactNode } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { ROTATION_BIN_LABELS } from "@/src/utilities/modern/rotationBinColors";

function MetaPill({
  children,
  color = "neutral",
}: {
  children: ReactNode;
  color?: ColorPaletteProp;
}) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={color}
      sx={{
        "--Chip-minHeight": "0.95rem",
        minHeight: "0.95rem",
        borderRadius: "xs",
        fontSize: "0.55rem",
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "0.015em",
        "& .MuiChip-label": { px: 0.375 },
      }}
    >
      {children}
    </Chip>
  );
}

/** Build the monospace catalog code, e.g. "Rock SF 101/4". */
function catalogCode(entry: AlbumEntry): string | null {
  const a = entry.artist;
  if (!a?.lettercode) return null;
  return `${a.genre ?? ""} ${a.lettercode} ${a.numbercode ?? "?"}/${entry.entry}`.trim();
}

/**
 * Small, visually-secondary metadata for a result row: rotation bin, format,
 * streaming-exclusive flag, and the catalog code. Kept subordinate to the
 * sentence line above it.
 */
export default function MetaPills({ entry }: { entry: AlbumEntry }) {
  const isVinyl = (entry.format ?? "").toLowerCase().includes("vinyl");
  const code = catalogCode(entry);

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{ mt: 0.35, minWidth: 0, flexWrap: "wrap", rowGap: 0.25 }}
    >
      {code ? (
        <Box
          component="span"
          sx={{
            fontFamily: "code",
            fontSize: "0.6rem",
            color: "text.tertiary",
            mr: 0.25,
          }}
        >
          {code}
        </Box>
      ) : null}

      {entry.rotation_bin ? (
        <MetaPill color="primary">
          {ROTATION_BIN_LABELS[entry.rotation_bin]} rotation
        </MetaPill>
      ) : null}

      <MetaPill color={isVinyl ? "primary" : "neutral"}>
        {isVinyl ? "vinyl" : "cd"}
      </MetaPill>

      {entry.on_streaming === false ? (
        <MetaPill color="danger">exclusive</MetaPill>
      ) : null}
    </Stack>
  );
}
