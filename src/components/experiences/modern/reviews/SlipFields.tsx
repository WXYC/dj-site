"use client";

import { FormControl, FormHelperText, FormLabel, Textarea } from "@mui/joy";
import type { ReviewPatch } from "@wxyc/shared";
import { FIELD_NAMES } from "@/lib/features/reviews/draftKeys";
import { REVIEW_COPY } from "./copy";

export type FieldName = (typeof FIELD_NAMES)[number];
export type FieldValues = Record<FieldName, string>;

export const emptyFieldValues = (): FieldValues => Object.fromEntries(FIELD_NAMES.map((n) => [n, ""])) as FieldValues;

const orNull = (text: string) => (text.trim() === "" ? null : text);

export const toFieldValues = (source: ReviewPatch): FieldValues =>
  Object.fromEntries(FIELD_NAMES.map((n) => [n, source[n] ?? ""])) as FieldValues;

/** The slip-field part of a patch, for the given fields only (a key left out is kept as stored): a blank or whitespace-only field is sent as null. */
export const toFieldPatch = (values: FieldValues, fields: readonly FieldName[] = FIELD_NAMES): ReviewPatch =>
  Object.fromEntries(fields.map((n) => [n, orNull(values[n])])) as ReviewPatch;

/** Whether two patches would save different things; a field changed and changed back is the same. */
export const patchChanged = (saved: ReviewPatch, current: ReviewPatch) => JSON.stringify(saved) !== JSON.stringify(current);

/** Draws `fields` (every slip field unless told otherwise), in slip order. */
export default function SlipFields({ values, onChange, fields = FIELD_NAMES }: { values: FieldValues; onChange: (values: FieldValues) => void; fields?: readonly FieldName[] }) {
  return (
    <>
      {FIELD_NAMES.filter((name) => fields.includes(name)).map((name) => (
        <FormControl key={name}>
          <FormLabel>{REVIEW_COPY.fields[name].label}</FormLabel>
          <FormHelperText>{REVIEW_COPY.fields[name].help}</FormHelperText>
          <Textarea minRows={name === "review" ? 6 : 1} value={values[name]} onChange={(e) => onChange({ ...values, [name]: e.target.value })} />
        </FormControl>
      ))}
    </>
  );
}
