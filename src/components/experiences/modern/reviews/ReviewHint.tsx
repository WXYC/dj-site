import { Typography } from "@mui/joy";
import { useReviewProbablyExists } from "@/src/hooks/useReviewProbablyExists";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

/** A review shelf row's hint that a review probably exists already; draws nothing when none is found. */
export default function ReviewHint({ artist, album }: { artist: string; album: string }) {
  const { library, formCount } = useReviewProbablyExists(artist, album, true);
  return (
    <>
      {library && <Typography level="body-sm">{COPY.hintLibrary(album)}</Typography>}
      {formCount > 0 && <Typography level="body-sm">{COPY.hintForms(formCount, artist)}</Typography>}
    </>
  );
}
