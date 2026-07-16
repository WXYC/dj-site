import { Box, Typography } from "@mui/joy";
import { Fragment } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { buildResultSentence } from "./buildResultSentence";
import { SMART_ENTRY_FIELD_COLOR } from "./smartEntryStyles";
import type { SmartField } from "./parser/types";
import { MatchedText } from "./MatchedText";

function valueColor(field: SmartField, selected: boolean) {
  if (selected) return "common.white";
  const color = SMART_ENTRY_FIELD_COLOR[field];
  return color === "plain" ? "text.primary" : `${color}.plainColor`;
}

/**
 * Renders a result as a single sentence line — "[album] by [artist] via
 * [label]" in the order the user typed — with each field value subtly tinted to
 * its type and the query-matched portion bolded. Truncates with an ellipsis.
 */
export default function SentenceText({
  entry,
  fieldOrder,
  query,
  selected = false,
}: {
  entry: AlbumEntry;
  fieldOrder: SmartField[];
  query: FlowsheetQuery;
  selected?: boolean;
}) {
  const parts = buildResultSentence(
    {
      artist: entry.artist?.name,
      album: entry.title,
      label: entry.label,
    },
    fieldOrder
  );

  return (
    <Typography
      component="div"
      level="body-sm"
      sx={{
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: selected ? "common.white" : "text.primary",
      }}
    >
      {parts.map((part, i) => (
        <Fragment key={part.field}>
          {part.connector ? (
            <Box
              component="span"
              sx={{ color: selected ? "neutral.300" : "text.tertiary" }}
            >
              {i > 0 ? " " : ""}
              {part.connector}{" "}
            </Box>
          ) : null}
          <Box component="span" sx={{ color: valueColor(part.field, selected) }}>
            <MatchedText text={part.value} query={query[part.field]} />
          </Box>
        </Fragment>
      ))}
    </Typography>
  );
}
