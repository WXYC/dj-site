"use client";

import type { JSX } from "react";
import { Button, Sheet, Stack, Typography } from "@mui/joy";
import { UNTRUSTWORTHY_CODE_ANSWER_MESSAGE } from "@/lib/features/catalog/libraryCodeResolution";
import type { ArtistByCodeOwner } from "@/lib/features/catalog/types";
import type { CompilationBucketOutcome } from "@/src/hooks/useCompilationBucketResolution";

export interface CompilationBucketPanelProps {
  outcome: CompilationBucketOutcome;
  owners: ArtistByCodeOwner[];
  /**
   * The genre whose shelf is being resolved, named rather than numbered: the
   * librarian picked it from a list and has no use for its id.
   */
  genreName: string | null;
  /** The bucket the filing would use — the sole owner, the pick, or the suggestion. */
  resolvedArtistId: number | null;
  /**
   * The shelf the album title alphabetizes onto, when the genre has one. Shown
   * as a caption on the selected row so the librarian can tell a suggestion
   * from their own choice — and knows to overrule it for the compilations
   * filed by subject rather than by title.
   */
  suggestedArtistId: number | null;
  onPick: (artistId: number) => void;
  onRetry: () => void;
  /** A refused filing to state here, since this panel owns the artist arm. */
  conflict: { message: string } | null;
  disabled: boolean;
}

/**
 * The artist arm of a Various Artists filing: which of the genre's compilation
 * buckets the release joins, resolved from the shelf's code rather than typed.
 *
 * Bucket names are shown verbatim and never preselected from the album title.
 * The sub-bucket letter survives only in the name — `Various Artists - Rock -
 * S`, `Soundtracks - K` — so only the librarian holding the record knows which
 * shelf it belongs on, and a guess here would file it somewhere unfindable.
 *
 * Native radios rather than the Joy control: nothing else in the app imports
 * Joy's Radio/RadioGroup, and pulling that module graph onto the bench for one
 * list costs every filing — including the majority that are not compilations —
 * while a grouped `input` already brings the semantics, the keyboard
 * behaviour, and the accessible name.
 *
 * Controlled: the pick and the lookup live with the resolution hook, because
 * the form's submit gate reads them too.
 */
export default function CompilationBucketPanel({
  outcome,
  owners,
  genreName,
  resolvedArtistId,
  suggestedArtistId,
  onPick,
  onRetry,
  conflict,
  disabled,
}: CompilationBucketPanelProps): JSX.Element {
  return (
    <Sheet
      component="section"
      aria-label="Various Artists shelf"
      variant="soft"
      sx={{ p: 1.5, borderRadius: "md" }}
    >
      {outcome === "resolving" && (
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Finding this genre&apos;s Various Artists shelf…
        </Typography>
      )}

      {outcome === "existing" && owners.length === 1 && (
        <Typography level="body-sm">
          Filing under {owners[0].artist_name} ({owners[0].code_letters}{" "}
          {owners[0].code_number})
        </Typography>
      )}

      {outcome === "picking" && (
        <>
          <Typography level="title-sm" sx={{ mb: 1 }}>
            Which compilation shelf?
          </Typography>
          <Stack spacing={0.25} sx={{ maxHeight: 220, overflowY: "auto" }}>
            {owners.map((owner) => (
              <Stack
                key={owner.id}
                component="label"
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ cursor: disabled ? "default" : "pointer", py: 0.25 }}
              >
                <input
                  type="radio"
                  // One name groups them, which is what gives arrow-key
                  // movement and single-selection without a control library.
                  name="compilation-shelf"
                  value={owner.id}
                  checked={resolvedArtistId === owner.id}
                  disabled={disabled}
                  onChange={() => onPick(owner.id)}
                />
                <Typography level="body-sm">{owner.artist_name}</Typography>
              </Stack>
            ))}
          </Stack>
          {suggestedArtistId !== null && resolvedArtistId === suggestedArtistId && (
            <Typography level="body-xs" sx={{ color: "text.secondary", mt: 0.75 }}>
              Suggested from the title — change it if this files elsewhere.
            </Typography>
          )}
        </>
      )}

      {outcome === "create" && (
        <Typography level="body-sm">
          First compilation in this genre — filing it creates the Various Artists
          shelf.
        </Typography>
      )}

      {outcome === "genre-missing" && (
        <Typography level="body-sm" color="danger" role="alert">
          {genreName === null ? "That genre" : `“${genreName}”`} is no longer in the
          catalog — reload the page to get the current genre list.
        </Typography>
      )}

      {outcome === "unavailable" && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography level="body-sm" color="danger" role="alert">
            {UNTRUSTWORTHY_CODE_ANSWER_MESSAGE}
          </Typography>
          {/* An untyped button inside a form submits it. */}
          <Button
            type="button"
            size="sm"
            variant="plain"
            disabled={disabled}
            onClick={onRetry}
            sx={{ px: 0 }}
          >
            Try again
          </Button>
        </Stack>
      )}

      {conflict !== null && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Typography level="body-sm" color="danger" role="alert">
            {conflict.message}
          </Typography>
          {/* An untyped button inside a form submits it. */}
          <Button
            type="button"
            size="sm"
            variant="plain"
            disabled={disabled}
            onClick={onRetry}
            sx={{ px: 0 }}
          >
            Look again
          </Button>
        </Stack>
      )}
    </Sheet>
  );
}
