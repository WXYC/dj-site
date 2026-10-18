import { useId, useState } from "react";
import { Autocomplete, Button, Typography } from "@mui/joy";
import type { Reviewer } from "@wxyc/shared";
import { matchReviewers } from "@/lib/features/reviews/reviewerMatch";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

const PHONE_QUERY = "(max-width: 599.95px)";
// The list's last line is an option so it sits inside the listbox; no account id is empty.
const OVERFLOW_ID = "";

interface IntakeRequestPickerProps {
  reviewers: Reviewer[];
  /** The id of the element holding the record's line, which names the button for the record it acts on. */
  labelledBy: string;
  artist: string;
  album: string;
  /** The row's `lock(id, "request")`. */
  busy: { loading: boolean; disabled: boolean };
  onRequest: (reviewer: Reviewer) => void;
}

/** One button that opens a search for the account to ask to review one record, and asks again before sending. */
export default function IntakeRequestPicker({ reviewers, labelledBy, artist, album, busy, onRequest }: IntakeRequestPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Reviewer | null>(null);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const buttonId = useId();

  const { shown, more } = matchReviewers(reviewers, query);
  const options = more > 0 ? [...shown, { id: OVERFLOW_ID, name: COPY.askOverflow(more) }] : shown;
  const close = () => {
    setOpen(false);
    setQuery("");
    setPicked(null);
  };

  return (
    <>
      <Button
        id={buttonId}
        size="sm"
        variant="outlined"
        {...busy}
        aria-haspopup="dialog"
        aria-labelledby={`${buttonId} ${labelledBy}`}
        onClick={() => setOpen(true)}
      >
        {COPY.askADj}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={close}
        role="dialog"
        titleId="ask-a-dj-title"
        title={COPY.askADj}
        layout={isPhone ? "fullscreen" : "center"}
        actions={
          picked ? (
            <>
              <Button variant="plain" onClick={() => setPicked(null)}>{COPY.back}</Button>
              <Button
                autoFocus
                onClick={() => {
                  onRequest(picked);
                  close();
                }}
              >
                {COPY.ask}
              </Button>
            </>
          ) : (
            // A phone's sheet hides the backdrop and its keyboard has no Escape.
            <Button variant="plain" onClick={close}>{REVIEW_COPY.screen.cancel}</Button>
          )
        }
      >
        {picked ? (
          <Typography>{COPY.askConfirm(picked.name, artist, album)}</Typography>
        ) : (
          <Autocomplete
            autoFocus
            autoHighlight
            open
            options={options}
            value={null}
            inputValue={query}
            // The matcher has already filtered, folded and capped the options.
            filterOptions={(all) => all}
            getOptionLabel={(r) => r.name}
            getOptionKey={(r) => r.id}
            getOptionDisabled={(r) => r.id === OVERFLOW_ID}
            placeholder={COPY.askSearch}
            slotProps={{ input: { "aria-label": COPY.askSearch }, listbox: { sx: { maxHeight: 320 } } }}
            // A pick resets the input to the picked name, which would rewrite the query Back returns to.
            onInputChange={(_e, value, reason) => {
              if (reason !== "reset") {
                setQuery(value);
              }
            }}
            // `open` is fixed, so Escape's close request is the dialog's.
            onClose={(_e, reason) => {
              if (reason === "escape") {
                close();
              }
            }}
            onChange={(_e, reviewer) => setPicked(reviewer)}
          />
        )}
      </ConfirmDialog>
    </>
  );
}
