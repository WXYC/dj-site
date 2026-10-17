import type { ReactNode } from "react";
import { Sheet, Stack, Typography } from "@mui/joy";
import { SectionToggle } from "./CiteControls";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intakeItem;

/** The page's one open section, which a button in the prompt row opens directly after it. */
export type OpenSection = "record" | "release" | "form" | null;

/**
 * The dashed row that starts a review of the record. Line one holds Record a review and its explanation; line two
 * holds the cite buttons (`cite`) or, in their place, whatever removes the citation (`removal`). The row takes no
 * place on the page of its own, and the page draws the open section right after it.
 */
export default function RecordPrompt({ open, onToggle, cite, disabled, removal }: {
  open: OpenSection;
  onToggle: (which: NonNullable<OpenSection>) => void;
  cite: boolean;
  disabled: boolean;
  removal?: ReactNode;
}) {
  return (
    <Sheet variant="outlined" sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5, borderStyle: "dashed", borderRadius: "sm" }}>
      <Stack data-line="one" direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <SectionToggle open={open === "record"} onClick={() => onToggle("record")}>{REVIEW_COPY.record.title}</SectionToggle>
        <Typography level="body-sm">{COPY.recordExplanation}</Typography>
      </Stack>
      {(cite || removal) && (
        <Stack data-line="two" direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {cite ? (
            <>
              <SectionToggle open={open === "release"} disabled={disabled} onClick={() => onToggle("release")}>{COPY.citeRelease}</SectionToggle>
              <SectionToggle open={open === "form"} disabled={disabled} onClick={() => onToggle("form")}>{COPY.citeForm}</SectionToggle>
            </>
          ) : (
            removal
          )}
        </Stack>
      )}
    </Sheet>
  );
}
