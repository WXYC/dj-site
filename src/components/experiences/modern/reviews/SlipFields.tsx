"use client";

import { FormControl, FormHelperText, FormLabel, Textarea } from "@mui/joy";
import type { Review, ReviewPatch } from "@wxyc/shared";
import { REVIEW_COPY } from "./copy";

export const FIELD_NAMES = ["buzzwords", "artist_blurb", "review", "recommended_tracks", "fcc"] as const;
export type FieldName = (typeof FIELD_NAMES)[number];
export type FieldValues = Record<FieldName, string>;

const orNull = (text: string) => (text.trim() === "" ? null : text);

export const toFieldValues = (review: Review): FieldValues =>
  Object.fromEntries(FIELD_NAMES.map((n) => [n, review[n] ?? ""])) as FieldValues;

/** The slip-field part of a patch: a blank or whitespace-only field is sent as null. */
export const toFieldPatch = (values: FieldValues): ReviewPatch =>
  Object.fromEntries(FIELD_NAMES.map((n) => [n, orNull(values[n])])) as ReviewPatch;

export default function SlipFields({ values, onChange }: { values: FieldValues; onChange: (values: FieldValues) => void }) {
  return (
    <>
      {FIELD_NAMES.map((name) => (
        <FormControl key={name}>
          <FormLabel>{REVIEW_COPY.fields[name].label}</FormLabel>
          <Textarea minRows={name === "review" ? 6 : 1} value={values[name]} onChange={(e) => onChange({ ...values, [name]: e.target.value })} />
          <FormHelperText>{REVIEW_COPY.fields[name].help}</FormHelperText>
        </FormControl>
      ))}
    </>
  );
}
