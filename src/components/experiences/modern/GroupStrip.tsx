import type { JSX } from "react";
import { Box, Typography } from "@mui/joy";
import { tabularNumsSx } from "@/src/utilities/modern/recordTableSx";

/** A strip's own colors, as `rotationBinColors` gives them; without them the strip is neutral. */
export type GroupStripColors = { bg: string; bgSelected: string; text: string; border: string };

/**
 * The bar that heads one group of records: its label in uppercase, then its count and an optional suffix.
 * It holds only phrasing content (`span`s), so it can sit inside a table header cell or a heading; the host decides where it sticks.
 */
export default function GroupStrip({
  label,
  count,
  suffix,
  colors,
}: {
  label: string;
  count: number;
  /** Follows the count on its line, such as " · 3 overdue". */
  suffix?: string;
  colors?: GroupStripColors;
}): JSX.Element {
  return (
    <Box
      component="span"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        bgcolor: colors ? colors.bg : "background.level1",
        color: colors ? colors.text : "text.secondary",
        boxShadow: colors ? `inset 4px 0 0 ${colors.bgSelected}` : undefined,
        borderBottom: "1px solid",
        borderColor: colors ? colors.border : "divider",
      }}
    >
      <Typography
        level="body-xs"
        textColor="inherit"
        sx={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "md" }}
      >
        {label}
      </Typography>
      <Typography level="body-xs" textColor="inherit" sx={{ opacity: 0.8, ...tabularNumsSx }}>
        {count}
        {suffix ?? ""}
      </Typography>
    </Box>
  );
}
