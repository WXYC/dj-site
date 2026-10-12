"use client";

import { useState } from "react";
import { Button, Checkbox, FormControl, FormHelperText, FormLabel, Input, Option, Radio, RadioGroup, Select, Stack, Typography } from "@mui/joy";
import type { NewReviewRequest } from "@wxyc/shared";
import { isReviewAccountGone, useCreateReviewMutation, useGetReviewersQuery, useSubmitReviewMutation } from "@/lib/features/reviews/reviewApi";
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
 * one create, or, with the box unticked, as one of the record's other reviews: a create then a submit. Either
 * reloads through the page's review-write path (`onWritten`). If the submit fails, the form closes like a success
 * but says the draft was saved and waits under My reviews: there is no second Save to create another review.
 * Names (the author, the picked account) are real names: station display only, never telemetry.
 * `hasCover` is whether a review is on the cover now or another write is putting one there; the helper line under
 * the checkbox reads it, but a ticked save keeps the line it had at the press, so its own save never changes it.
 * `disabled` is the page's hold on every review write (another write is in flight or rereading): Save is out of reach.
 * `onPending` is the page's setter for that hold: a ticked save calls it with true at the press, and with false if the create fails.
 */
export default function RecordReviewForm({ itemId, hasCover, disabled, onPending, onWritten, onNotice, onClose }: {
  itemId: number;
  hasCover: boolean;
  disabled: boolean;
  onPending: (pending: boolean) => void;
  onWritten: () => Promise<void>;
  onNotice: (line: string | null) => void;
  onClose: () => void;
}) {
  const { data: auth } = useAuthentication();
  const me = "user" in auth ? auth.user?.id : undefined;
  const reviewers = useGetReviewersQuery();
  const [create] = useCreateReviewMutation();
  const [submit] = useSubmitReviewMutation();
  const mounted = useMounted();
  const [author, setAuthor] = useState("");
  const [values, setValues] = useState<FieldValues>({ buzzwords: "", artist_blurb: "", review: "", recommended_tracks: "", fcc: "" });
  const [medium, setMedium] = useState<NonNullable<NewReviewRequest["medium"]>>("typed");
  const [linked, setLinked] = useState(""); // the picked account's id; "" is Not linked
  const [onCover, setOnCover] = useState(true);
  const [tried, setTried] = useState(false);
  // From a valid press until the page's reread settles, so a second press cannot record the review twice.
  const [saving, setSaving] = useState(false);
  // What the helper line said when a ticked save was pressed, so that save's own hold on the page does not change it.
  const [coverAtPress, setCoverAtPress] = useState<boolean | null>(null);
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
    // Only a ticked save moves the cover, so only it holds the page's other buttons from the press.
    if (onCover) {
      setCoverAtPress(hasCover);
      onPending(true);
    }
    const body: NewReviewRequest = {
      intake_item_id: itemId,
      author: name,
      medium,
      accept: onCover,
      ...(linked !== "" && { author_user_id: linked }),
      ...toFieldPatch(values),
    };
    try {
      const made = await create(body).unwrap();
      let line: string = COPY.recorded;
      if (!onCover) {
        try {
          await submit(made.id).unwrap();
        } catch {
          // The draft exists and is finished from My reviews; the form closes so no second Save can create another.
          line = COPY.draftNotSubmitted;
        }
      }
      await onWritten();
      if (!mounted.current) return;
      onNotice(line);
      onClose();
    } catch (err) {
      if (onCover) onPending(false);
      if (!mounted.current) return;
      setSaving(false);
      setCoverAtPress(null);
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
      <Checkbox label={COPY.useAsCover} checked={onCover} onChange={(e) => setOnCover(e.target.checked)} />
      <Typography level="body-sm">{!onCover ? COPY.otherReview : (coverAtPress ?? hasCover) ? COPY.coverReplaces : COPY.coverNone}</Typography>
      <Button loading={saving} disabled={disabled} onClick={record} sx={{ alignSelf: "flex-start" }}>{REVIEW_COPY.save}</Button>
      {failure && <Typography role="alert">{failure}</Typography>}
    </Stack>
  );
}
