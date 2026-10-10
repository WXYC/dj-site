"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Stack, Typography } from "@mui/joy";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import {
  isIntakeNotReviewed,
  useGetIntakeItemQuery,
  usePrintIntakeItemMutation,
} from "@/lib/features/reviews/intakeApi";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { useMounted } from "@/src/hooks/useRowWrite";
import { REVIEW_COPY } from "./copy";
import { recordLine, intakeRecord } from "./recordLine";
import { formatStationLongDate } from "@/src/utilities/stationTime";
import { useItemPageReload } from "./useItemPageReload";
import { useSlipPrint } from "./useSlipPrint";

const COPY = REVIEW_COPY.intakeSlip;

/** The music directors' print page for one record's slip. The print request goes out on the press, never on load. */
export default function IntakeSlipScreen({ id }: { id: number }) {
  const visible = useCanSeeReviews();
  const item = useGetIntakeItemQuery(id, { skip: !visible });
  const [print, { isLoading }] = usePrintIntakeItemMutation();
  const { showAndPrint, clear, sheet } = useSlipPrint();
  const dispatch = useAppDispatch();
  const mounted = useMounted();
  const reload = useItemPageReload(id);
  // What the refusal was, decided only from the record as reloaded after it.
  const [refusal, setRefusal] = useState<"noCover" | "handwritten" | null>(null);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!visible) return null;
  if (hasNothingToShow(item) || reloadFailed) return <Typography role="alert">{REVIEW_COPY.intakeItem.loadFailed}</Typography>;
  if (!item.data) return null;

  const onPress = async () => {
    setRefusal(null);
    setFailed(false);
    try {
      const printed = await print(id).unwrap();
      showAndPrint(printed);
    } catch (err) {
      if (!isIntakeNotReviewed(err)) return setFailed(true);
      clear();
      // Reload first: the page as loaded may be older than the refusal.
      const reloaded = await reload();
      if (!reloaded.mounted) return;
      if (reloaded.item == null) return setReloadFailed(true);
      const coverId = reloaded.item.accepted_review_id;
      if (coverId == null) return setRefusal("noCover");
      const read = await dispatch(reviewApi.endpoints.getReview.initiate(coverId, { subscribe: false, forceRefetch: true }));
      if (!mounted.current) return;
      const cover = read.isError ? null : (read.data ?? null);
      if (cover == null) return setReloadFailed(true);
      // A typed review on the cover means a second press prints.
      if (cover.medium === "handwritten") setRefusal("handwritten");
      else setFailed(true);
    }
  };

  const lastPrinted = item.data.printed_at;
  return (
    <Stack spacing={2}>
      <Typography level="title-lg">{recordLine(intakeRecord(item.data))}</Typography>
      {lastPrinted && <Typography>{COPY.lastPrinted} {formatStationLongDate(lastPrinted)}. {COPY.reprint}</Typography>}
      {refusal && <Typography role="alert">{COPY[refusal]}</Typography>}
      {refusal === "noCover" && (
        <Link href={`/dashboard/admin/intake/${id}`}>{COPY.backToRecord}</Link>
      )}
      {failed && <Typography role="alert">{REVIEW_COPY.screen.writeFailed}</Typography>}
      <Button loading={isLoading} onClick={onPress} sx={{ alignSelf: "flex-start" }}>
        {REVIEW_COPY.intakeItem.printSlip}
      </Button>
      {sheet}
    </Stack>
  );
}
