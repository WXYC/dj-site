import type { ReactNode } from "react";
import { Box, Chip, Divider, Link, Typography } from "@mui/joy";
import { formatLabel, formatTone } from "@/lib/features/experiences/modern/tokens/roles";
import { useRecordFormatName } from "./recordLine";
import type { ReviewRecord } from "./useReviewRecord";

/**
 * A sleeve with a disc edge, toned by the record's format through the theme's
 * format palettes, so every theme and color mode gets its own hue.
 */
export function FormatGlyph({ format, size = 40 }: { format: string | undefined; size?: number }) {
  const { color } = formatTone(format);
  return (
    <Box
      aria-hidden
      data-tone={color}
      sx={{ position: "relative", flex: "none", width: size, height: size, borderRadius: "sm", bgcolor: `${color}.softBg`, border: "1px solid", borderColor: `${color}.solidBg`, overflow: "hidden" }}
    >
      <Box sx={{ position: "absolute", top: "50%", right: -size / 4, width: size / 2, height: size / 2, mt: `${-size / 4}px`, borderRadius: "50%", bgcolor: `${color}.solidBg` }} />
    </Box>
  );
}

/** The record's parts, stacked: the label is omitted when empty and the format tag when there is no format. */
export function RecordParts({ record, format, artist }: { record: ReviewRecord; format: string | undefined; artist: ReactNode }) {
  return (
    <>
      {artist}
      <Typography level="body-md">{record.album}</Typography>
      {record.label && <Typography level="body-sm">{record.label}</Typography>}
      {format && (
        <Chip size="sm" variant="soft" color={formatTone(format).color}>
          {formatLabel(format)}
        </Chip>
      )}
    </>
  );
}

interface RecordRowProps {
  record: ReviewRecord;
  /** Dates and chips, under the record. */
  meta?: ReactNode;
  /** Buttons: at the right edge when the row is wide, below the record when it is narrow. */
  actions?: ReactNode;
  /** A state sentence and quiet buttons, on a line under a divider; absent when not passed. */
  status?: ReactNode;
  /** Links the artist to the record's page. Ignored when `titleSlot` is given. */
  href?: string;
  /**
   * The title, in place of the plain or linked artist: for a caller that needs its own title link, such as one carrying an `id` that a control's `aria-labelledby` points at.
   * It wins over `href` when both are given.
   */
  titleSlot?: ReactNode;
}

/**
 * One record in a list: a format glyph beside the artist, album, label and
 * format tag, then `meta`, with `actions` to the right or below. The layout
 * answers to the row's own width (a container query), not the window's, since
 * the sidebars change the column width.
 */
export default function RecordRow({ record, meta, actions, status, href, titleSlot }: RecordRowProps) {
  const format = useRecordFormatName(record);
  const artist = titleSlot ?? (href ? (
    <Link level="title-md" href={href}>{record.artist}</Link>
  ) : (
    <Typography level="title-md">{record.artist}</Typography>
  ));
  return (
    <Box sx={{ width: "100%", containerType: "inline-size" }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, "@container (min-width: 560px)": { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } }}>
        <Box sx={{ display: "flex", gap: 1.5, minWidth: 0 }}>
          <FormatGlyph format={format} />
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.25, minWidth: 0 }}>
            <RecordParts record={record} format={format} artist={artist} />
            {meta}
          </Box>
        </Box>
        {actions && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flex: "none" }}>{actions}</Box>}
      </Box>
      {status && (
        <>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>{status}</Box>
        </>
      )}
    </Box>
  );
}
