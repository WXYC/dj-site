"use client";

import { useState } from "react";
import { Button, FormControl, FormHelperText, FormLabel, Stack, Textarea, Typography } from "@mui/joy";
import type { Review } from "@wxyc/shared";
import { toast } from "sonner";
import {
  useGetReviewQuery,
  useUpdateReviewMutation,
} from "@/lib/features/reviews/api";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { REVIEW_COPY } from "./copy";
import SlipPreview from "./SlipPreview";
import { useReviewRecord } from "./useReviewRecord";

const FIELD_NAMES = ["buzzwords", "artist_blurb", "review", "recommended_tracks", "fcc"] as const;
type FieldName = (typeof FIELD_NAMES)[number];

function Form({ review }: { review: Review }) {
  const [values, setValues] = useState<Record<FieldName, string>>(
    () => Object.fromEntries(FIELD_NAMES.map((n) => [n, review[n] ?? ""])) as Record<FieldName, string>,
  );
  const [update, { isLoading }] = useUpdateReviewMutation();
  const record = useReviewRecord(review);

  const save = async () => {
    try {
      await update({ id: review.id, patch: values }).unwrap();
      toast.success(REVIEW_COPY.saved);
    } catch {
      toast.error(REVIEW_COPY.couldNotSave);
    }
  };

  return (
    <Stack direction="row" spacing={3} alignItems="flex-start" flexWrap="wrap">
      <Stack spacing={2} sx={{ flex: 1, minWidth: 280 }}>
        {review.status === "draft" && <Typography level="body-sm">{REVIEW_COPY.draftPrivacy}</Typography>}
        {FIELD_NAMES.map((name) => (
          <FormControl key={name}>
            <FormLabel>{REVIEW_COPY.fields[name].label}</FormLabel>
            <Textarea minRows={name === "review" ? 6 : 1} value={values[name]} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
            <FormHelperText>{REVIEW_COPY.fields[name].help}</FormHelperText>
          </FormControl>
        ))}
        <Button loading={isLoading} onClick={save}>{REVIEW_COPY.saveDraft}</Button>
      </Stack>
      <SlipPreview
        artist={record?.artist ?? ""}
        album={record?.album ?? ""}
        label={record?.label ?? ""}
        reviewer={review.author ?? ""}
        date={review.add_date}
        fields={values}
      />
    </Stack>
  );
}

export default function ReviewEditor({ id }: { id: number }) {
  const { data: auth } = useAuthentication();
  const visible = canSeeReviews(("user" in auth ? auth.user?.authority : undefined) ?? Authorization.NO);
  const { data, isError } = useGetReviewQuery(id, { skip: !visible });

  if (!visible) return null;
  if (isError) return <Typography role="alert">{REVIEW_COPY.couldNotLoad}</Typography>;
  return data ? <Form review={data} /> : null;
}
