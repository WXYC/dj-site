"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { displayedArtist, isVariousArtists } from "@/lib/features/catalog/libraryCode";
import { formatLabel } from "@/lib/features/experiences/modern/tokens/roles";
import { AlbumMetadata, ResolvedToken } from "@/lib/features/metadata/types";
import { isRotationAdminEnabled } from "@/lib/features/rotation/flags";
import {
  Box,
  Button,
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
import { useCallback, useId, useRef, useState, useEffect } from "react";
import { NotOnDiscogsBadge } from "@/src/components/experiences/modern/catalog/AlbumArtwork";
import ReviewsPanel from "@/src/components/experiences/modern/reviews/ReviewsPanel";
import { RequireMD } from "@/src/components/shared/Authorization";
import AlbumArtworkWithRotationBadge from "./AlbumArtworkWithRotationBadge";
import AlbumEditTabs from "./AlbumEditTabs";
import DiscardChangesDialog from "./DiscardChangesDialog";
import DiscogsMarkup from "./DiscogsMarkupRenderer";
import LibraryStatus from "./LibraryStatus";
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
  /** Called with whether the editor holds unsaved changes, so whatever hosts the card can ask before its own exits drop them. */
  onUnsavedChange?: (unsaved: boolean) => void;
}

/**
 * A release's details card on the modern experience. It opens read-only for
 * every account; MD+ accounts get an Edit button that swaps the card's body
 * below the header for the tabbed editor, and a Close editor button that swaps
 * it back, asking first when a tab holds unsaved changes. Mount with
 * `key={album.id}`: edit mode, the bio's Read More and every draft belong to
 * one release.
 */
export default function AlbumCard({
  album,
  artworkUrl,
  metadata,
  metadataLoading,
  artistBio,
  bioTokens,
  artistWikipediaUrl,
  onUnsavedChange,
}: AlbumCardProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioOverflows, setBioOverflows] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editorUnsaved, setEditorUnsaved] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const editorId = useId();
  const reportEditorUnsaved = useCallback(
    (unsaved: boolean) => {
      setEditorUnsaved(unsaved);
      onUnsavedChange?.(unsaved);
    },
    [onUnsavedChange],
  );

  // The editor reports nothing once unmounted, so its last report is cleared here.
  const closeEditor = () => {
    setConfirmingClose(false);
    reportEditorUnsaved(false);
    setIsEditing(false);
  };

  useEffect(() => {
    const el = bioRef.current;
    if (el) {
      setBioOverflows(el.scrollHeight > el.clientHeight);
    }
    // The bio is not rendered while editing, so it is measured again on Done.
  }, [artistBio, isEditing]);

  // MD-flagged release: the matched Discogs release is wrong or inapplicable
  // (embargoed promo, audience-segment release, etc). Blocks sourced from the
  // /metadata/album proxy — artwork, label/year/genre/style, artist bio,
  // tracklist, and the Discogs footer link — are gated on this flag rather than
  // on `metadata` being present, so the suppression holds even if a caller still
  // fetches metadata for a flagged album. The Listen chips are the exception:
  // the release's definitive `urls` are release-scoped catalog data, not
  // proxy-sourced, and are the authoritative fallback precisely when the
  // auto-match is untrustworthy — so they render regardless of this flag, while
  // the flag still suppresses the proxy-sourced LML/Discogs chips beside them.
  // Library-owned data (title, LibraryStatus, plays/add date) is unaffected —
  // the flag says nothing about the library entry itself.
  const isDiscogsUnavailable = album.discogsUnavailable === true;

  // Gate the definitive-links override on the rotation-admin flag so the whole
  // feature ships dark: with the flag off the release's `urls` are dropped
  // before they can reach the Listen merge or the render condition, leaving the
  // chips byte-identical to the LML-only rendering even if Backend has begun
  // emitting populated `urls`. Evaluated at render time — the flag is inlined
  // at build, but a render-time read keeps the gate testable and matches the
  // rest of the rotation-admin surface. Flipping the flag on restores the full
  // override (definitive links win over LML, empty urls render no chips).
  const definitiveUrls = isRotationAdminEnabled() ? album.urls : undefined;

  // Drawn by the read-only body and by the editor's Discogs tab, never both at once.
  const tracklist = isDiscogsUnavailable ? null : metadataLoading ? (
    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
      <CircularProgress size="sm" />
    </Box>
  ) : (
    <Tracklist tracklist={metadata?.tracklist} />
  );

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
            <AlbumArtworkWithRotationBadge
              album={album}
              artworkUrl={artworkUrl}
              alt={`${album.title} cover`}
              codePreview={{
                genreName: album.artist.genre,
                genreId: album.artist.genre_id,
                compLetter: album.artist.code_comp_letter,
                codeLetters: album.artist.lettercode,
                artistNumber: album.artist.numbercode,
                albumEntry: album.entry,
                formatLabel: album.format,
              }}
            />
          )}
          <Stack sx={{ minWidth: 0, justifyContent: "center" }}>
            {/* The shelf's own artist name, never a compilation label derived
                from `album_artist`. That column is written by the nightly
                catalog import and by nothing else, and is empty for every row
                on the compilation shelf, so a branch on it renders for nobody
                — while the shelf name it was displacing (`Soundtracks - K`,
                `Various Artists - Rock - S`) is the sub-bucket a librarian
                needs to tell one compilation bucket from another. */}
            <Typography level="title-lg" sx={{ mb: 0.5 }}>
              {album.artist.name} &bull; {album.title}
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
                    {album.label || ""}{album.label ? " \u2022 " : ""}{album?.format ? formatLabel(album.format) : ""}
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
        {/* UI only: Backend-Service enforces the MD tier on every write, and
            each control keeps its own RequireMD gate. */}
        <RequireMD>
          <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1 }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              aria-expanded={isEditing}
              aria-controls={isEditing ? editorId : undefined}
              onClick={() => {
                if (!isEditing) {
                  setIsEditing(true);
                } else if (editorUnsaved) {
                  setConfirmingClose(true);
                } else {
                  closeEditor();
                }
              }}
            >
              {isEditing ? "Close editor" : "Edit"}
            </Button>
          </Stack>
        </RequireMD>
        <DiscardChangesDialog
          open={confirmingClose}
          onDiscard={closeEditor}
          onKeepEditing={() => setConfirmingClose(false)}
        />
        {isEditing ? (
          <AlbumEditTabs
            id={editorId}
            album={album}
            tracklist={tracklist}
            onUnsavedChange={reportEditorUnsaved}
          />
        ) : (
          <>
            {(definitiveUrls?.length || !isDiscogsUnavailable) && (
              <StreamingLinks
                metadata={metadata}
                urls={definitiveUrls}
                discogsUnavailable={isDiscogsUnavailable}
              />
            )}
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
            {album.id != null && (
              <ReviewsPanel
                albumId={album.id}
                record={{ artist: displayedArtist(album.alternate_artist, album.artist.name, isVariousArtists(album.artist.lettercode)), album: album.title, label: album.label ?? "" }}
              />
            )}
            <Divider sx={{ my: 1 }} />
            {tracklist}
          </>
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
