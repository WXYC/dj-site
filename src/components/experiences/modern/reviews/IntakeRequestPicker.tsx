import { Fragment, useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { Autocomplete, Button, List, ListItem, ListSubheader, Typography } from "@mui/joy";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import type { Reviewer } from "@wxyc/shared";
import { describeReviewer, distinctOnAir, matchReviewers, suggestReviewers, type FoldedReviewer } from "@/lib/features/reviews/reviewerMatch";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import ConfirmDialog from "../ConfirmDialog";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

const PHONE_QUERY = "(max-width: 599.95px)";
// Literal ids: Joy bakes the dialog's aria ids into its CSS selector, and only one picker's dialog is open at a time.
const TITLE_ID = "ask-a-dj-title";
const QUESTION_ID = "ask-a-dj-question";

/** The list's lines: a name, or one of two lines that are options only so they sit inside the listbox. */
type Option = { kind: "reviewer"; reviewer: Reviewer } | { kind: "overflow"; more: number } | { kind: "searchAll"; total: number };
// Or search all's group: it is not a suggestion, so it draws outside the Suggested group.
const NO_GROUP = "";
const optionLabel = (o: Option) =>
  o.kind === "reviewer" ? o.reviewer.name : o.kind === "overflow" ? COPY.askOverflow(o.more) : COPY.searchAll(o.total);

interface AskADjDialogProps {
  /** The accounts that can be asked, folded once by the caller with `foldReviewers`. */
  reviewers: FoldedReviewer[];
  /** The reviewers read is still on its way, so the search shows a loading line rather than no match. */
  loading: boolean;
  /** The reviewers read failed with nothing to show, so the search says so rather than no match. */
  failed: boolean;
  /** The ids of the accounts that passed on this record; the list puts them last and says so. */
  passedIds: ReadonlySet<string>;
  artist: string;
  album: string;
  open: boolean;
  /** Runs after the dialog has reset itself, whether it was dismissed or Ask sent the request. */
  onClose: () => void;
  onRequest: (reviewer: Reviewer) => void;
}

interface IntakeRequestPickerProps extends Omit<AskADjDialogProps, "open" | "onClose"> {
  /** The row's `lock(id, "request")`. */
  busy: { loading: boolean; disabled: boolean };
}

/** The dialog that searches for the account to ask to review one record, and asks again before sending. The caller owns whether it is open and what opens it. */
export function AskADjDialog({ reviewers, loading, failed, passedIds, artist, album, open, onClose, onRequest }: AskADjDialogProps) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Reviewer | null>(null);
  // Set by choosing "Or search all"; only close() clears it.
  const [searchAll, setSearchAll] = useState(false);
  const isPhone = useMediaQuery(PHONE_QUERY);

  // Every row draws a picker; only the open one runs the search.
  const suggestions = open && query.trim() === "" && !searchAll ? suggestReviewers(reviewers, passedIds) : [];
  const suggesting = suggestions.length > 0;
  const { shown, more } = open && !suggesting ? matchReviewers(reviewers, query, passedIds) : { shown: [], more: 0 };
  const options: Option[] = suggesting
    ? [...suggestions.map((reviewer) => ({ kind: "reviewer" as const, reviewer })), { kind: "searchAll", total: reviewers.length }]
    : [...shown.map((reviewer) => ({ kind: "reviewer" as const, reviewer })), ...(more > 0 ? [{ kind: "overflow" as const, more }] : [])];
  const close = () => {
    onClose();
    setSearchAll(false);
    setQuery("");
    setPicked(null);
  };
  // The question takes focus rather than Ask, so the Enter that picked a name, or a second one close behind it, sends nothing; stable, so a re-render doesn't pull focus back from Back or Ask.
  const focusQuestion = useCallback((el: HTMLElement | null) => el?.focus(), []);

  return (
    <ConfirmDialog
      open={open}
      onClose={close}
      role="dialog"
      titleId={TITLE_ID}
      describedBy={picked ? QUESTION_ID : undefined}
      title={COPY.askADj}
      layout={isPhone ? "fullscreen" : "center"}
      actions={
        picked ? (
          <>
            <Button variant="plain" onClick={() => setPicked(null)}>{COPY.back}</Button>
            <Button
              aria-describedby={QUESTION_ID}
              onClick={() => {
                // The dialog closes, and hands focus back to the control that opened it, before the request's row lock can disable that control.
                flushSync(close);
                onRequest(picked);
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
        <Typography id={QUESTION_ID} tabIndex={-1} ref={focusQuestion}>{COPY.askConfirm(picked.name, artist, album, distinctOnAir(picked))}</Typography>
      ) : (
        <Autocomplete
          // Or search all swaps every line under the highlight, which Joy keeps by index while the count holds; a fresh list starts it on the first line again.
          key={searchAll ? "all" : "suggested"}
          autoFocus
          autoHighlight
          open
          options={options}
          value={null}
          inputValue={query}
          // The matcher has already filtered, folded and capped the options.
          filterOptions={(all) => all}
          loading={loading}
          loadingText={COPY.askLoading}
          noOptionsText={failed ? COPY.askLoadFailed : COPY.askNoMatch}
          getOptionLabel={optionLabel}
          getOptionKey={(o) => (o.kind === "reviewer" ? o.reviewer.id : o.kind)}
          getOptionDisabled={(o) => o.kind === "overflow"}
          groupBy={suggesting ? (o) => (o.kind === "searchAll" ? NO_GROUP : COPY.suggested) : undefined}
          // Joy's own group is a bare list item, which names no group: role="group" is set only inside a Menu or a Select. The nested subheader names the list.
          renderGroup={({ key, group, children }) =>
            group === NO_GROUP ? (
              <Fragment key={key}>{children}</Fragment>
            ) : (
              <ListItem key={key} nested role="presentation">
                <ListSubheader sticky>{group}</ListSubheader>
                <List role="group">{children}</List>
              </ListItem>
            )
          }
          renderOption={(props, o) => {
            const { key, ...rest } = props as typeof props & { key: string };
            return (
              <AutocompleteOption key={key} {...rest} sx={{ flexDirection: "column", alignItems: "flex-start" }}>
                <Typography level="body-md">{optionLabel(o)}</Typography>
                {o.kind === "reviewer" &&
                  describeReviewer(o.reviewer, passedIds.has(o.reviewer.id)).map((line) => (
                    <Typography key={line} level="body-xs">{line}</Typography>
                  ))}
              </AutocompleteOption>
            );
          }}
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
          onChange={(_e, o) => {
            if (o?.kind === "searchAll") {
              setSearchAll(true);
            } else if (o?.kind === "reviewer") {
              setPicked(o.reviewer);
            }
          }}
        />
      )}
    </ConfirmDialog>
  );
}

/** One button that opens the dialog, on a page about one record, so it is named by its own words. */
export default function IntakeRequestPicker({ busy, ...dialog }: IntakeRequestPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outlined"
        {...busy}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {COPY.askADj}
      </Button>
      <AskADjDialog {...dialog} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
