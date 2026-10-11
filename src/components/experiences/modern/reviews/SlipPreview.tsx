import type { ReactNode } from "react";
import { styled } from "@mui/joy/styles";
import type { ReviewFields } from "@wxyc/shared";
import { REVIEW_COPY } from "./copy";

export type SlipPreviewProps = {
  /** The record rows are left off together when the slip is not about this page's record. */
  artist?: string;
  album?: string;
  label?: string;
  /** The Reviewer row is left off when this is undefined. */
  reviewer?: string;
  date?: string;
  fields: Pick<ReviewFields, "buzzwords" | "artist_blurb" | "review" | "recommended_tracks" | "fcc">;
  /** The record's confirmed FCC notes, printed under the FCC row. */
  fccNotes?: string[];
  /** Tape is drawn across the top edge on screen when this review is the one on the cover. */
  onCover?: boolean;
};

// Everything that makes the slip look like paper sits under `@media screen`, so the printed slip keeps its plain box.
const Slip = styled("div")({
  width: "4.25in",
  maxWidth: "100%",
  border: "1px solid currentColor",
  padding: "0.1in",
  display: "grid",
  gap: "0.06in",
  fontSize: "0.8rem",
  "@media screen": {
    position: "relative",
    boxSizing: "border-box",
    background: "var(--wxyc-palette-background-surface)",
    borderColor: "var(--wxyc-palette-divider)",
    boxShadow: "0 1px 4px var(--wxyc-palette-neutral-400)",
    "& > div": { borderBottom: "1px solid var(--wxyc-palette-divider)", paddingBottom: "0.04in" },
    "& > div:last-of-type": { borderBottom: "none", paddingBottom: 0 },
  },
});

const Label = styled("strong")(({ theme }) => ({ flex: "0 0 0.82in", fontWeight: theme.fontWeight.lg }));

const Tape = styled("span")({
  display: "none",
  "@media screen": {
    display: "block",
    position: "absolute",
    top: "-0.08in",
    width: "0.7in",
    height: "0.18in",
    background: "var(--wxyc-palette-neutral-400)",
    opacity: 0.6,
  },
});

const row = (name: string, body: ReactNode) => (
  <div style={{ display: "flex", gap: "4pt" }}>
    <Label>{name}</Label>
    <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>{body}</div>
  </div>
);

/** The FCC row is its own piece so the print view can hand it more lines. */
export function SlipFccRow({ fcc, notes = [] }: { fcc?: string | null; notes?: string[] }) {
  return row(
    REVIEW_COPY.fields.fcc.label,
    [fcc, ...notes].filter(Boolean).map((line, i) => <div key={i}>{line}</div>),
  );
}

/** The station's printed slip: a box 4.25 in wide (never wider than its column) with a 0.82 in label column and a 4 pt gap after it. */
export default function SlipPreview({ artist, album, label, reviewer, date, fields, fccNotes, onCover }: SlipPreviewProps) {
  const { fields: names, slip } = REVIEW_COPY;
  return (
    <Slip aria-label={slip.name} role="group">
      {onCover && (
        <>
          <Tape aria-hidden style={{ left: "0.4in", transform: "rotate(-3deg)" }} />
          <Tape aria-hidden style={{ right: "0.4in", transform: "rotate(3deg)" }} />
        </>
      )}
      {artist !== undefined && row(slip.artist, artist)}
      {album !== undefined && row(slip.album, album)}
      {label !== undefined && row(slip.label, label)}
      {row(names.buzzwords.label, fields.buzzwords)}
      {row(slip.artistBlurb, fields.artist_blurb)}
      {row(slip.review, fields.review)}
      {reviewer !== undefined && row(slip.reviewer, `${reviewer} ${date ?? ""}`.trim())}
      {row(slip.recommended, fields.recommended_tracks)}
      <SlipFccRow fcc={fields.fcc} notes={fccNotes} />
    </Slip>
  );
}
