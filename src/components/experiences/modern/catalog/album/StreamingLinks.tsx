import { AlbumMetadata } from "@/lib/features/metadata/types";
import { mergeListenLinks } from "@/lib/features/catalog/listenLinks";
import { Chip, Stack } from "@mui/joy";

interface StreamingLinksProps {
  metadata: AlbumMetadata | null;
  /**
   * The release's definitive (music-director) links, folded into the chips:
   * a matching-service link overrides LML's, a new-service link is added, and
   * an unrecognised or unparseable value is kept (labelled by host, or as a
   * non-anchor). See `mergeListenLinks`.
   */
  urls?: string[];
  /**
   * The matched Discogs release is flagged wrong or inapplicable, so the
   * LML/Discogs-proxy metadata describes the wrong release. Its chips are
   * suppressed by merging against empty metadata, leaving only the
   * release-scoped definitive `urls` — the authoritative links precisely when
   * the auto-match cannot be trusted.
   */
  discogsUnavailable?: boolean;
}

export default function StreamingLinks({
  metadata,
  urls,
  discogsUnavailable,
}: StreamingLinksProps) {
  const links = mergeListenLinks(discogsUnavailable ? null : metadata, urls);

  if (links.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
      {links.map((link) =>
        link.href ? (
          <Chip
            key={link.key}
            variant="outlined"
            size="sm"
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </Chip>
        ) : (
          <Chip key={link.key} variant="outlined" size="sm">
            {link.label}
          </Chip>
        ),
      )}
    </Stack>
  );
}
