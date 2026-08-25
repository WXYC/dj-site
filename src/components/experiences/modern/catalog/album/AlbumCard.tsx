"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { AlbumMetadata, ResolvedToken } from "@/lib/features/metadata/types";
import {
  Box,
  Card,
  CardContent,
  CardOverflow,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/joy";
import { useRef, useState, useEffect } from "react";
import { NotOnDiscogsBadge } from "@/src/components/experiences/modern/catalog/AlbumArtwork";
import AlbumArtworkWithCodeOverlay from "./AlbumArtworkWithCodeOverlay";
import AlbumEditForm from "./AlbumEditForm";
import DiscogsMarkup from "./DiscogsMarkupRenderer";
import DiscogsUnavailableControl from "./DiscogsUnavailableControl";
import LibraryStatus from "./LibraryStatus";
import RotationClassifyControl from "./RotationClassifyControl";
import StreamingLinks from "./StreamingLinks";
import Tracklist from "./Tracklist";

interface AlbumCardProps {
  album: AlbumEntry;
  artworkUrl: string;
  metadata: AlbumMetadata | null;
  metadataLoading: boolean;
  artistBio: string | null;
  bioTokens: ResolvedToken[] | null;
  artistWikipediaUrl: string | null;
}

export default function AlbumCard({
  album,
  artworkUrl,
  metadata,
  metadataLoading,
  artistBio,
  bioTokens,
  artistWikipediaUrl,
}: AlbumCardProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioOverflows, setBioOverflows] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bioRef.current;
    if (el) {
      setBioOverflows(el.scrollHeight > el.clientHeight);
    }
  }, [artistBio]);

  // MD-flagged release: the matched Discogs release is wrong or inapplicable
  // (embargoed promo, audience-segment release, etc). Every block sourced
  // from the /metadata/album proxy — artwork, label/year/genre/style,
  // streaming links, artist bio, tracklist, and the Discogs footer link — is
  // gated on this flag rather than on `metadata` being present, so the
  // suppression holds even if a caller still fetches metadata for a flagged
  // album. Library-owned data (title, LibraryStatus, plays/add date) is
  // unaffected — the flag says nothing about the library entry itself.
  const isDiscogsUnavailable = album.discogsUnavailable === true;

  return (
    <Card
      variant="outlined"
      sx={{
        overflow: "auto",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
          {isDiscogsUnavailable ? (
            <NotOnDiscogsBadge
              size={{ xs: 120, lg: 160 }}
              note={album.discogsUnavailableNote}
            />
          ) : (
            <AlbumArtworkWithCodeOverlay
              artworkUrl={artworkUrl}
              alt={`${album.title} cover`}
              codePreview={{
                genreName: album.artist.genre,
                codeLetters: album.artist.lettercode,
                artistNumber: album.artist.numbercode,
                albumEntry: album.entry,
                formatLabel: album.format,
                rotation: album.rotation_bin ?? null,
              }}
            />
          )}
          <Stack sx={{ minWidth: 0, justifyContent: "center" }}>
            <Typography level="title-lg" sx={{ mb: 0.5 }}>
              {album.album_artist ? "Various Artists" : album.artist.name} &bull; {album.title}
            </Typography>
            {album.album_artist && (
              <Typography level="body-sm" sx={{ mb: 0.5 }}>
                {album.album_artist}
              </Typography>
            )}
            {isDiscogsUnavailable ? (
              album.discogsUnavailableNote && (
                <Typography
                  level="body-sm"
                  sx={{ mb: 1, color: "text.tertiary", fontStyle: "italic" }}
                >
                  {album.discogsUnavailableNote}
                </Typography>
              )
            ) : (
              <Stack
                direction="row"
                spacing={1}
                sx={{ mb: 1, flexWrap: "wrap", alignItems: "center" }}
              >
                {metadata?.label && (
                  <Typography level="body-sm">{metadata.label}</Typography>
                )}
                {metadata?.label && metadata.releaseYear ? (
                  <Typography level="body-sm">&bull;</Typography>
                ) : null}
                {metadata?.releaseYear ? (
                  <Typography level="body-sm">{metadata.releaseYear}</Typography>
                ) : null}
                {!metadata && !metadataLoading && (
                  <Typography level="body-sm">
                    {album.label || ""}{album.label ? " \u2022 " : ""}{album?.format ?? ""}
                  </Typography>
                )}
                {metadata?.genres?.map((g) => (
                  <Chip key={g} size="sm" variant="soft">
                    {g}
                  </Chip>
                ))}
                {metadata?.styles?.map((s) => (
                  <Chip key={s} size="sm" variant="outlined">
                    {s}
                  </Chip>
                ))}
              </Stack>
            )}
            <LibraryStatus album={album} />
          </Stack>
        </Stack>
        <DiscogsUnavailableControl key={album.id} album={album} />
        <AlbumEditForm key={album.id} album={album} />
        <RotationClassifyControl key={album.id} album={album} />
        {!isDiscogsUnavailable && <StreamingLinks metadata={metadata} />}
        {!isDiscogsUnavailable && artistBio && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography level="title-sm" sx={{ mb: 0.5 }}>
              About {album.album_artist ?? album.artist.name}
              {artistWikipediaUrl && (
                <Link
                  href={artistWikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  level="body-xs"
                  sx={{ ml: 1 }}
                >
                  Wikipedia
                </Link>
              )}
            </Typography>
            <Typography
              ref={bioRef}
              component="div"
              level="body-sm"
              sx={{
                ...(!bioExpanded && { maxHeight: 80, overflow: "hidden" }),
                color: "text.secondary",
              }}
            >
              {bioTokens ? <DiscogsMarkup tokens={bioTokens} /> : artistBio}
            </Typography>
            {bioOverflows && !bioExpanded && (
              <Link
                component="button"
                level="body-xs"
                onClick={() => setBioExpanded(true)}
              >
                Read More
              </Link>
            )}
          </>
        )}
        <Divider sx={{ my: 1 }} />
        {isDiscogsUnavailable ? null : metadataLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size="sm" />
          </Box>
        ) : (
          <Tracklist tracklist={metadata?.tracklist} />
        )}
      </CardContent>
      <CardOverflow
        variant="soft"
        sx={{
          display: "flex",
          gap: 1.5,
          py: 1.5,
          px: "var(--Card-padding)",
          bgcolor: "background.level1",
        }}
      >
        <Stack direction="row" spacing={1}>
          <Typography
            level="body-sm"
            sx={{ fontWeight: "md", color: "text.secondary" }}
          >
            {album.plays ?? 0} plays
          </Typography>
          <Divider orientation="vertical" />
          <Typography
            level="body-sm"
            sx={{ fontWeight: "md", color: "text.secondary" }}
          >
            Added{" "}
            {!album.add_date
              ? "Unknown Time"
              : new Date(album.add_date).toLocaleDateString()}
          </Typography>
          {!isDiscogsUnavailable && metadata?.discogsUrl && (
            <>
              <Divider orientation="vertical" />
              <Link
                href={metadata.discogsUrl}
                target="_blank"
                rel="noopener noreferrer"
                level="body-sm"
                sx={{ fontWeight: "md" }}
              >
                Discogs
              </Link>
            </>
          )}
        </Stack>
      </CardOverflow>
    </Card>
  );
}
