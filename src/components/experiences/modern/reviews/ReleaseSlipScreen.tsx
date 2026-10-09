"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Stack, Typography } from "@mui/joy";
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { isLibraryPrintRefused, usePrintReleaseReviewMutation } from "@/lib/features/reviews/libraryApi";
import { useGetReviewQuery } from "@/lib/features/reviews/reviewApi";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";
import { REVIEW_COPY } from "./copy";
import { useSlipPrint } from "./useSlipPrint";

const COPY = REVIEW_COPY.releaseSlip;

/** The music directors' print page for one typed review of a library record. The print request goes out on the press, never on load. */
export default function ReleaseSlipScreen({ albumId, reviewId }: { albumId: number; reviewId: number }) {
  const visible = useCanSeeReviews();
  const review = useGetReviewQuery(reviewId, { skip: !visible });
  const album = useGetInformationQuery({ album_id: albumId }, { skip: !visible });
  const [print, { isLoading }] = usePrintReleaseReviewMutation();
  const { showAndPrint, clear, sheet } = useSlipPrint();
  const [failure, setFailure] = useState<"refused" | "failed" | null>(null);

  if (!visible) return null;
  if (hasNothingToShow(review) || hasNothingToShow(album)) return <Typography role="alert">{REVIEW_COPY.intakeItem.loadFailed}</Typography>;
  if (!review.data || !album.data) return null;

  const onPress = async () => {
    setFailure(null);
    try {
      showAndPrint(await print({ albumId, reviewId }).unwrap());
    } catch (err) {
      clear();
      setFailure(isLibraryPrintRefused(err) ? "refused" : "failed");
    }
  };

  return (
    <Stack spacing={2}>
      <Typography>{COPY.lead(review.data.author ?? "", album.data.artist.name, album.data.title)}</Typography>
      {failure === "refused" && <Typography role="alert">{COPY.refused}</Typography>}
      {failure === "refused" && <Link href="/dashboard/catalog">{COPY.backToCatalog}</Link>}
      {failure === "failed" && <Typography role="alert">{REVIEW_COPY.screen.writeFailed}</Typography>}
      <Button loading={isLoading} onClick={onPress} sx={{ alignSelf: "flex-start" }}>
        {REVIEW_COPY.intakeItem.printSlip}
      </Button>
      {sheet}
    </Stack>
  );
}
