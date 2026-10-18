import { useId, useState, type ReactNode } from "react";
import { Box, Chip, Divider, Link, Typography } from "@mui/joy";
import { useAlbumArtwork } from "@/lib/features/metadata/hooks";
import { formatLabel, formatTone } from "@/lib/features/experiences/modern/tokens/roles";
import { useRecordFormatName } from "./recordLine";
import ListenLinks from "./ListenLinks";
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
export function RecordParts({ record, format, artist, albumId }: { record: ReviewRecord; format: string | undefined; artist: ReactNode; albumId?: string }) {
  return (
    <>
      {artist}
      <Typography id={albumId} level="body-md">{record.album}</Typography>
      {record.label && <Typography level="body-sm">{record.label}</Typography>}
      {format && (
        <Chip size="sm" variant="soft" color={formatTone(format).color}>
          {formatLabel(format)}
        </Chip>
      )}
    </>
  );
}

/** The row's own title link, if the caller brings one: the slot and the `id` it carries come together, since the row's listen links are named by that `id`. */
export type RecordRowTitle =
  | {
      /**
       * The title, in place of the plain or linked artist: for a caller that needs its own title link, such as one carrying an `id` that a control's `aria-labelledby` points at.
       * It wins over `href` when both are given.
       */
      titleSlot: ReactNode;
      /** The `id` the `titleSlot` carries, so the row's listen links are named by it. */
      titleId: string;
    }
  | { titleSlot?: undefined; titleId?: undefined };

type RecordRowProps = {
  record: ReviewRecord;
  /** Dates and chips, under the record. */
  meta?: ReactNode;
  /** Buttons: at the right edge when the row is wide, below the record when it is narrow. */
  actions?: ReactNode;
  /** A state sentence and quiet buttons, on a line under a divider; absent when not passed. */
  status?: ReactNode;
  /** Links the artist to the record's page. Ignored when `titleSlot` is given. */
  href?: string;
  /** An `id` for the album line, for a control's `aria-labelledby` that names the record by its artist and album. */
  albumId?: string;
  /** The tile's size in px. With it, the row shows the record's cover, and the format glyph while the cover loads, fails or does not exist; without it, the 40 px glyph and no metadata read. */
  cover?: 72 | 56;
} & RecordRowTitle;

/** A row's first control of its own: its buttons, or the Open link of a review. The Preview links before them open in a new tab, and the focus must not land on one. */
export const PRIMARY_CONTROL = "button, a[href]:not([target='_blank'])";

/**
 * One record in a list: a format glyph beside the artist, album, label and
 * format tag, then `meta`, with `actions` to the right or below. The layout
 * answers to the row's own width (a container query), not the window's, since
 * the sidebars change the column width.
 */
export default function RecordRow({ record, meta, actions, status, href, titleSlot, titleId, albumId, cover }: RecordRowProps) {
  const format = useRecordFormatName(record);
  // The row's own ids name its listen links by the artist and album; a row with no links carries none.
  const ownId = useId();
  const linked = Boolean(record.links?.length);
  const ownArtistId = linked ? `${ownId}artist` : undefined;
  const artistId = titleSlot ? titleId : ownArtistId;
  const recordAlbumId = albumId ?? (linked ? `${ownId}album` : undefined);
  // The current answer only: a row drawn for another record never shows the last one's cover while its own read is pending or failed.
  const { currentMetadata } = useAlbumArtwork(record.artist, record.album, cover === undefined, { decorative: true });
  // Held by URL, not as a flag, so a row drawn for another record never keeps this one's failure.
  const [failedUrl, setFailedUrl] = useState<string>();
  // `useAlbumArtwork`'s own `artworkUrl` falls back to a cassette image; only the service's answer counts here.
  const artworkUrl = cover ? currentMetadata?.artworkUrl : undefined;
  const showCover = Boolean(artworkUrl) && artworkUrl !== failedUrl;
  const artist = titleSlot ?? (href ? (
    <Link id={artistId} level="title-md" href={href}>{record.artist}</Link>
  ) : (
    <Typography id={artistId} level="title-md">{record.artist}</Typography>
  ));
  return (
    <Box sx={{ width: "100%", containerType: "inline-size" }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, "@container (min-width: 560px)": { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } }}>
        <Box sx={{ display: "flex", gap: 1.5, minWidth: 0 }}>
          {showCover ? (
            <Box
              component="img"
              src={artworkUrl}
              alt=""
              loading="lazy"
              onError={() => { setFailedUrl(artworkUrl); }}
              sx={{ flex: "none", width: cover, height: cover, borderRadius: "sm", objectFit: "cover" }}
            />
          ) : (
            <FormatGlyph format={format} size={cover} />
          )}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.25, minWidth: 0 }}>
            <RecordParts record={record} format={format} artist={artist} albumId={recordAlbumId} />
            {meta}
            <ListenLinks links={record.links} labelledBy={[artistId, recordAlbumId].filter(Boolean).join(" ")} />
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
