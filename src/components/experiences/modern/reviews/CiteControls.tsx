"use client";

import { useId, useState } from "react";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import { Button, FormControl, FormHelperText, FormLabel, Input, Stack, Typography } from "@mui/joy";
import type { AlbumReview } from "@wxyc/shared";
import { useGetAlbumReviewsByArtistQuery } from "@/lib/features/reviews/albumReviewApi";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";
import ReleasePicker from "./ReleasePicker";
import { formatSlipDate } from "./slipDate";

const COPY = REVIEW_COPY.intakeItem;

/** The form archive's reviews of one artist, prefilled from the record's and searched at once; copying one is the only way to use it. */
function FormReviewSearch({ artist, onCopy }: { artist: string; onCopy: (review: AlbumReview) => void }) {
  const [text, setText] = useState(artist);
  const [term, setTerm] = useState(artist.trim());
  const results = useGetAlbumReviewsByArtistQuery(term, { skip: term === "" });
  // The current term's answer only: `data` carries the previous term's rows over.
  const reviews = results.currentData;
  return (
    <Stack spacing={1}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = text.trim();
          // The same term re-initiates nothing by itself, and the failure line asks for another try.
          if (next !== term) {
            setTerm(next);
          } else if (next !== "") {
            results.refetch();
          }
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <FormControl>
            <FormLabel>{COPY.formArtist}</FormLabel>
            <Input value={text} onChange={(e) => setText(e.target.value)} />
            <FormHelperText>{COPY.formArtistNote}</FormHelperText>
          </FormControl>
          <Button type="submit">{COPY.search}</Button>
        </Stack>
      </form>
      {results.isError && <Typography role="alert">{COPY.formSearchFailed}</Typography>}
      {reviews?.length === 0 && <Typography>{COPY.formNone}</Typography>}
      {!!reviews?.length && <Typography>{COPY.formNotPrintable}</Typography>}
      {reviews?.map((take) => {
        const detail = [take.record_label, take.reviewer, take.submitted_at && formatSlipDate(take.submitted_at)].filter((v) => v?.trim()).join(" · ");
        return (
          <Stack key={take.id} spacing={0.5}>
            {take.album_title && <Typography level="body-sm" fontWeight="lg">{take.album_title}</Typography>}
            {detail && <Typography level="body-sm" sx={{ color: "text.secondary" }}>{detail}</Typography>}
            <Typography component="blockquote" level="body-sm" sx={{ m: 0 }}>{take.review}</Typography>
            <Button variant="outlined" size="sm" onClick={() => onCopy(take)} sx={{ alignSelf: "flex-start" }}>{COPY.copyOntoRecord}</Button>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** Hides an element on screen and keeps it in the accessibility tree. */
const visuallyHidden = { position: "absolute", width: "1px", height: "1px", p: 0, m: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 } as const;

/** One of the page's three openers: the Record a review button or a cite button. It reads as pressed while its section is open. */
export function SectionToggle({ open, disabled, onClick, children }: { open: boolean; disabled?: boolean; onClick: () => void; children: string }) {
  return (
    <Button variant={open ? "soft" : "outlined"} aria-expanded={open} disabled={disabled} onClick={onClick} endDecorator={<KeyboardArrowDown sx={{ transform: open ? "rotate(180deg)" : "none" }} />}>
      {children}
    </Button>
  );
}

/** The search a cite button opens: a library release (picking one cites it) or a form review (copying one starts a review of this record from it). The heading names the region and is hidden on screen, because it repeats the button above. */
export function CiteSection({ which, artist, onCite, onCopy }: {
  which: "release" | "form";
  artist: string;
  onCite: (albumId: number) => void;
  onCopy: (review: AlbumReview) => void;
}) {
  const headingId = useId();
  return (
    <Stack component="section" aria-labelledby={headingId} spacing={1}>
      <Typography id={headingId} level="title-sm" component="h3" sx={visuallyHidden}>{which === "release" ? COPY.citeRelease : COPY.citeForm}</Typography>
      {which === "release" ? (
        <ReleasePicker searchLabel={COPY.searchCite} onPick={(release) => release.id != null && onCite(release.id)} />
      ) : (
        <FormReviewSearch artist={artist} onCopy={onCopy} />
      )}
    </Stack>
  );
}

/** Takes the record's citation away. It asks first (`asksFirst`) when that also takes its review off the cover. */
export function RemoveCitation({ asksFirst, disabled, onRemove }: { asksFirst: boolean; disabled: boolean; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const remove = () => {
    setConfirming(false);
    onRemove();
  };
  return (
    <>
      <Button variant="outlined" disabled={disabled} onClick={asksFirst ? () => setConfirming(true) : remove} sx={{ alignSelf: "flex-start" }}>{COPY.removeCitation}</Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={COPY.removeAsksCover}
        titleId="remove-citation-title"
        actions={
          <>
            <Button variant="plain" onClick={() => setConfirming(false)}>{REVIEW_COPY.screen.cancel}</Button>
            <Button onClick={remove}>{COPY.removeIt}</Button>
          </>
        }
      >
        {null}
      </ConfirmDialog>
    </>
  );
}
