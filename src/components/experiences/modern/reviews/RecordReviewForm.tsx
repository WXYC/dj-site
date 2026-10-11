"use client";

import { useState } from "react";
import { Button, FormControl, FormHelperText, FormLabel, Input, Option, Radio, RadioGroup, Select, Stack, Typography } from "@mui/joy";
import type { NewReviewRequest } from "@wxyc/shared";
import { isReviewAccountGone, useCreateReviewMutation, useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { serverMessage, unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useMounted } from "@/src/hooks/useRowWrite";
import { REVIEW_COPY } from "./copy";
import SlipFields, { toFieldPatch, type FieldValues } from "./SlipFields";

const COPY = REVIEW_COPY.record;

/** The longest author the service accepts, in code points. */
const AUTHOR_MAX = 128;

/**
 * Records a review of the logged record `itemId` on someone's behalf, or a handwritten one, onto the cover in
 * one create. That changes the cover, so it reloads through the page's review-write path (`onWritten`).
 * Names (the author, the picked account) are real names: station display only, never telemetry.
 */
export default function RecordReviewForm({ itemId, hasCover, onWritten, onNotice, onClose }: {
  itemId: number;
  hasCover: boolean;
  onWritten: () => Promise<void>;
  onNotice: (line: string | null) => void;
  onClose: () => void;
}) {
  const { data: auth } = useAuthentication();
  const me = "user" in auth ? auth.user?.id : undefined;
  const reviewers = useGetReviewersQuery();
  const [create] = useCreateReviewMutation();
  const mounted = useMounted();
  const [author, setAuthor] = useState("");
  const [values, setValues] = useState<FieldValues>({ buzzwords: "", artist_blurb: "", review: "", recommended_tracks: "", fcc: "" });
  const [medium, setMedium] = useState<NonNullable<NewReviewRequest["medium"]>>("typed");
  const [linked, setLinked] = useState(""); // the picked account's id; "" is Not linked
  const [tried, setTried] = useState(false);
  // From a valid press until the page's reread settles, so a second press cannot record the review twice.
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const name = author.trim();
  const authorBlank = name === "";
  const textBlank = medium === "typed" && values.review.trim() === "";
  const emailed = linked !== "" && linked !== me ? reviewers.data?.find((r) => r.id === linked)?.name : undefined;

  const record = async () => {
    setTried(true);
    setFailure(null);
    // Each of these would be a 400; the field itself stops typing at the author limit.
    if (saving || authorBlank || textBlank || [...name].length > AUTHOR_MAX) return;
    setSaving(true);
    onNotice(null);
    const body: NewReviewRequest = {
      intake_item_id: itemId,
      author: name,
      medium,
      accept: true,
      ...(linked !== "" && { author_user_id: linked }),
      ...toFieldPatch(values),
    };
    try {
      await create(body).unwrap();
      await onWritten();
      if (!mounted.current) return;
      onNotice(COPY.recorded);
      onClose();
    } catch (err) {
      if (!mounted.current) return;
      setSaving(false);
      const refusal = unwrapEndpointError("reviewWriteError", err);
      // The server's own words only for a 400 that named no account; with one, the page's line says it.
      setFailure(
        isReviewAccountGone(err, linked !== "")
          ? COPY.accountGone
          : (refusal?.status === 400 ? serverMessage(refusal.data) : undefined) ?? COPY.couldNotRecord,
      );
    }
  };

  return (
    <Stack spacing={2}>
      <Typography level="title-sm" component="h3">{COPY.title}</Typography>
      <FormControl>
        <FormLabel>{COPY.author}</FormLabel>
        <Input value={author} onChange={(e) => setAuthor(e.target.value)} slotProps={{ input: { maxLength: AUTHOR_MAX } }} />
        {tried && authorBlank && <FormHelperText>{COPY.authorBlank}</FormHelperText>}
      </FormControl>
      <FormControl>
        <FormLabel>{COPY.account}</FormLabel>
        <Select value={linked} onChange={(_e, id) => setLinked(id ?? "")}>
          <Option value="">{COPY.notLinked}</Option>
          {reviewers.data?.map((r) => <Option key={r.id} value={r.id}>{r.name}</Option>)}
        </Select>
        {reviewers.isError && <FormHelperText>{COPY.accountsFailed}</FormHelperText>}
        {emailed && <FormHelperText>{COPY.emailed(emailed)}</FormHelperText>}
      </FormControl>
      <FormControl>
        <FormLabel>{COPY.medium}</FormLabel>
        <RadioGroup orientation="horizontal" value={medium} onChange={(e) => setMedium(e.target.value as typeof medium)}>
          <Radio value="typed" label={COPY.typed} />
          <Radio value="handwritten" label={COPY.handwritten} />
        </RadioGroup>
      </FormControl>
      {medium === "handwritten" && <Typography level="body-sm">{COPY.handwrittenNote}</Typography>}
      <SlipFields values={values} onChange={setValues} />
      {tried && textBlank && <Typography level="body-sm">{COPY.textBlank}</Typography>}
      <Typography level="body-sm">{COPY.noConsent}</Typography>
      <Typography level="body-sm">{hasCover ? COPY.coverReplaces : COPY.coverNone}</Typography>
      <Button loading={saving} onClick={record} sx={{ alignSelf: "flex-start" }}>{REVIEW_COPY.save}</Button>
      {failure && <Typography role="alert">{failure}</Typography>}
    </Stack>
  );
}
