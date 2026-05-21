"use client";

import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";

import { isCatalogTrackSearchUiEnabled } from "@/lib/features/catalog/flags";
import type { TrackMatchHint } from "@/lib/features/catalog/types";

const VISIBLE_LIMIT = 3;

function describeHint(hint: TrackMatchHint): string {
  const parts = [hint.title];
  if (hint.artist_credit) parts.push(`by ${hint.artist_credit}`);
  if (hint.position) parts.push(`(${hint.position})`);
  return parts.join(" ");
}

export function MatchedTrackChips({
  matched_via,
}: {
  matched_via: TrackMatchHint[] | undefined;
}) {
  if (!isCatalogTrackSearchUiEnabled()) {
    return null;
  }
  if (!matched_via || matched_via.length === 0) {
    return null;
  }

  const visible = matched_via.slice(0, VISIBLE_LIMIT);
  const overflow = matched_via.slice(VISIBLE_LIMIT);

  return (
    <Stack
      direction="row"
      gap={0.5}
      flexWrap="wrap"
      sx={{ marginTop: 0.5 }}
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((hint, idx) => {
        const label = `matched on track: ${hint.title}`;
        const ariaLabel = `matched on track: ${describeHint(hint)}`;
        return (
          <Tooltip
            key={`${hint.source}:${hint.title}:${idx}`}
            title={describeHint(hint)}
            variant="outlined"
            size="sm"
          >
            <Chip
              size="sm"
              variant="soft"
              color="primary"
              tabIndex={0}
              aria-label={ariaLabel}
            >
              {label}
            </Chip>
          </Tooltip>
        );
      })}
      {overflow.length > 0 && (
        <Tooltip
          title={overflow.map((hint) => hint.title).join(", ")}
          variant="outlined"
          size="sm"
        >
          <Chip
            size="sm"
            variant="soft"
            color="neutral"
            tabIndex={0}
            aria-label={`${overflow.length} more matched tracks: ${overflow
              .map((hint) => hint.title)
              .join(", ")}`}
          >
            +{overflow.length} more
          </Chip>
        </Tooltip>
      )}
    </Stack>
  );
}
