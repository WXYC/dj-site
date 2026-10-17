import type { ReactNode } from "react";
import { Box, Typography } from "@mui/joy";
import type { ReviewRecord } from "./useReviewRecord";
import { FormatGlyph, RecordParts } from "./RecordRow";
import { useRecordFormatName } from "./recordLine";

interface RecordHeaderProps {
  record: ReviewRecord;
  /** A state chip and links, beside the record. */
  chip?: ReactNode;
  /** The artist heading's level: 2 where this is the page title, 3 beneath a PageHeader. Defaults to 2. */
  headingLevel?: 2 | 3;
}

/**
 * A record's title: a larger glyph and the artist as a heading, then album,
 * label and format tag, with a slot for a state chip and links. In the review
 * editor, which draws no PageHeader, the artist is the page's only `h2`.
 * Beneath a PageHeader (the intake record page), pass `headingLevel={3}` so
 * the page keeps one `h2`.
 */
export default function RecordHeader({ record, chip, headingLevel = 2 }: RecordHeaderProps) {
  const format = useRecordFormatName(record);
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
      <FormatGlyph format={format} size={64} />
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5, minWidth: 0 }}>
        <RecordParts record={record} format={format} artist={<Typography level="h3" component={`h${headingLevel}`}>{record.artist}</Typography>} />
        {chip}
      </Box>
    </Box>
  );
}
