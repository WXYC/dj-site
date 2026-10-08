import type { ReactNode } from "react";
import type { ReviewFields } from "@wxyc/shared";
import { REVIEW_COPY } from "./copy";

export type SlipPreviewProps = {
  artist: string;
  album: string;
  label: string;
  reviewer: string;
  date: string;
  fields: Pick<ReviewFields, "buzzwords" | "artist_blurb" | "review" | "recommended_tracks" | "fcc">;
  /** The record's confirmed FCC notes, printed under the FCC row. */
  fccNotes?: string[];
};

const row = (name: string, body: ReactNode) => (
  <div style={{ display: "flex", gap: "0.1in" }}>
    <strong style={{ flex: "0 0 0.82in" }}>{name}</strong>
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

/** The station's printed slip: a ruled box 4.25 in wide with a 0.82 in label column. */
export default function SlipPreview({ artist, album, label, reviewer, date, fields, fccNotes }: SlipPreviewProps) {
  const { fields: names } = REVIEW_COPY;
  return (
    <div aria-label="Slip preview" role="group" style={{ width: "4.25in", border: "1px solid currentColor", padding: "0.1in", display: "grid", gap: "0.06in", fontSize: "0.8rem" }}>
      {row("Artist", artist)}
      {row("Album", album)}
      {row("Label", label)}
      {row(names.buzzwords.label, fields.buzzwords)}
      {row("Artist", fields.artist_blurb)}
      {row("Review", fields.review)}
      {row("Reviewer", `${reviewer} ${date}`.trim())}
      {row("Recommended", fields.recommended_tracks)}
      <SlipFccRow fcc={fields.fcc} notes={fccNotes} />
    </div>
  );
}
