"use client";

import Close from "@mui/icons-material/Close";
import { Box, Divider, IconButton, Stack, Typography } from "@mui/joy";
import type { ReactNode } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { FlowsheetQuery, SelectedMatch } from "@/lib/features/flowsheet/types";
import type { SmartResultGroup } from "./deriveSmartResults";
import SmartResultRow from "./SmartResultRow";
import { selectedMatchToEntry } from "./useFlowsheetSmartEntry";
import type { SmartField } from "./parser/types";

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      level="body-xs"
      sx={{
        color: "text.tertiary",
        px: 1,
        pt: 0.85,
        pb: 0.35,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontSize: "0.65rem",
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * The results surface: the promoted "Selected match" at top (with a remove
 * affordance), then the labelled result groups as sentence rows. Rows are
 * indexed 1..N for keyboard nav; `highlightIndex` marks the arrow-highlighted
 * one. Renders nothing when there is neither a match nor any results.
 */
export default function SmartResults({
  selectedMatch,
  groups,
  fieldOrder,
  query,
  highlightIndex,
  onSelect,
  onHover,
  onRemoveMatch,
  emptyHint,
}: {
  selectedMatch: SelectedMatch | null;
  groups: SmartResultGroup[];
  fieldOrder: SmartField[];
  query: FlowsheetQuery;
  highlightIndex: number;
  onSelect: (entry: AlbumEntry) => void;
  onHover: (index: number) => void;
  onRemoveMatch: () => void;
  emptyHint?: ReactNode;
}) {
  const hasResults = groups.length > 0;
  if (!selectedMatch && !hasResults) {
    return emptyHint ? (
      <Box sx={{ px: 1.5, py: 1.5 }}>{emptyHint}</Box>
    ) : null;
  }

  // Precompute the 1-based flat index at which each group starts.
  let offset = 0;
  const groupStart = groups.map((g) => {
    const start = offset;
    offset += g.entries.length;
    return start;
  });

  return (
    <Box
      role="listbox"
      id="flowsheet-results-listbox"
      data-testid="flowsheet-search-results"
      sx={{ overflowY: "auto", px: 0.5, pb: 1 }}
    >
      {selectedMatch ? (
        <Box>
          <GroupLabel>Selected match</GroupLabel>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SmartResultRow
                entry={selectedMatchToEntry(selectedMatch)}
                fieldOrder={fieldOrder}
                query={query}
                tone="promoted"
                onSelect={() => {}}
              />
            </Box>
            <IconButton
              size="sm"
              variant="plain"
              aria-label="Remove selected match"
              onMouseDown={(e) => {
                e.preventDefault();
                onRemoveMatch();
              }}
            >
              <Close />
            </IconButton>
          </Stack>
          {hasResults ? <Divider sx={{ my: 0.75 }} /> : null}
        </Box>
      ) : null}

      {groups.map((group, gi) => (
        <Box key={group.key}>
          <GroupLabel>{group.label}</GroupLabel>
          {group.entries.map((entry, j) => {
            const index = groupStart[gi] + j + 1; // 1-based flat index
            return (
              <SmartResultRow
                key={entry.id}
                entry={entry}
                index={index}
                fieldOrder={fieldOrder}
                query={query}
                tone={highlightIndex === index ? "highlight" : "plain"}
                onSelect={onSelect}
                onHover={onHover}
              />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
