import type { ReactNode } from "react";
import { Box, Typography } from "@mui/joy";
import type { ReviewRecord } from "./useReviewRecord";
import { FormatGlyph, RecordParts } from "./RecordRow";
import { useRecordFormatName } from "./recordLine";

interface RecordHeaderProps {
  record: ReviewRecord;
  /** A state chip and links, beside the record. */
  chip?: ReactNode;
}

/**
 * The top of a record's page or the review editor: a larger glyph and the
 * artist as an `h3` (under the page's `h2` header), then album, label and
 * format tag, with a slot for a state chip and links.
 */
export default function RecordHeader({ record, chip }: RecordHeaderProps) {
  const format = useRecordFormatName(record);
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
      <FormatGlyph format={format} size={64} />
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5, minWidth: 0 }}>
        <RecordParts record={record} format={format} artist={<Typography level="h3" component="h3">{record.artist}</Typography>} />
        {chip}
      </Box>
    </Box>
  );
}
