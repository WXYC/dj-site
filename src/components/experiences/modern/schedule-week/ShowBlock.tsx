"use client";

import { Box, Typography } from "@mui/joy";
import Link from "next/link";
import type { ShowBlock as ShowBlockModel } from "@/lib/features/schedule-week/layout";

// Two thresholds, because the label is two lines and the column is only ~640px
// for a whole day: an hour of airtime is ~27px, which fits one line of body-xs
// but not two. Below the first a block shows nothing and carries its name only
// in the accessible name; between the two it shows the name alone; above the
// second there is room for the time range as well. A single threshold clips the
// second line mid-glyph on every hour-long show.
const NAME_THRESHOLD_FRACTION = 30 / (24 * 60);
const TIME_RANGE_THRESHOLD_FRACTION = 75 / (24 * 60);

export default function ShowBlock({
  block,
  href,
}: {
  block: ShowBlockModel;
  /** Where this show lives. A show is a destination, not a detail row. */
  href: string;
}) {
  const label = [block.showName ?? block.djName ?? "Unattributed", block.timeRangeLabel]
    .filter(Boolean)
    .join(" — ");
  const showsName = block.heightFraction >= NAME_THRESHOLD_FRACTION;
  const showsTimeRange = block.heightFraction >= TIME_RANGE_THRESHOLD_FRACTION;

  return (
    <Box
      component={Link}
      href={href}
      aria-label={label}
      title={block.endIsInferred ? `${label} (no sign-off recorded)` : label}
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        top: `${block.topFraction * 100}%`,
        height: `${block.heightFraction * 100}%`,
        minHeight: "3px",
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "center",
        px: 0.5,
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderRadius: "2px",
        bgcolor: "background.level2",
        textDecoration: "none",
        color: "inherit",
        display: "block",
        // An unrecorded sign-off is drawn as an open edge, so a minimum-height
        // block does not read as a genuinely short show.
        borderBottomStyle: block.endIsInferred ? "dashed" : "solid",
        "&:hover": { bgcolor: "primary.softHoverBg" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.solidBg" },
      }}
    >
      {showsName && (
        <Typography level="body-xs" noWrap sx={{ lineHeight: 1.2 }}>
          {block.showName ?? block.djName ?? "Unattributed"}
          {showsTimeRange && (
            <Box component="span" sx={{ display: "block", opacity: 0.7 }}>
              {block.timeRangeLabel}
            </Box>
          )}
        </Typography>
      )}
    </Box>
  );
}
