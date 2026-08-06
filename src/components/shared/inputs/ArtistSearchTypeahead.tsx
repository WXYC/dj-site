"use client";

import { RequireMD } from "@/src/components/shared/Authorization";
import { useSearchArtistsInGenreQuery } from "@/lib/features/catalog/api";
import type { ArtistInGenreOption } from "@/lib/features/catalog/types";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { ClickAwayListener } from "@mui/base/ClickAwayListener";
import { Box, Button, CircularProgress, Input, Sheet, Typography } from "@mui/joy";
import { useCallback, useId, useRef, useState } from "react";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;

/** Nothing highlighted. Arrow keys and hover are the only way onto a row. */
const NO_HIGHLIGHT = -1;

/**
 * The "create new" row, held as a sentinel rather than as the index one past
 * the last result. Those two are indistinguishable as numbers, so a result set
 * that shrinks under a live highlight would silently slide it onto creation:
 * the highlight must only land there when the user navigated there.
 */
const CREATE_HIGHLIGHT = -2;

/** Shared empty result so a render with no rows keeps a stable identity. */
const NO_ARTISTS: ArtistInGenreOption[] = [];

/**
 * Shared, MD-gated artist-search typeahead.
 *
 * The search text is caller-owned (`value` / `onChange`): consumers mount this
 * inside forms that need to seed the field with an already-linked artist and to
 * clear it on cancel or after a save, neither of which is reachable if the query
 * string is private to this component.
 *
 * `onSelect` receives the full artist — downstream callers need the display name
 * as well as the id — and runs after the `onChange` that writes the picked name
 * into the field, so a caller that rewrites `value` from inside `onSelect` wins.
 *
 * `onCreateNew` hands the raw search term back rather than driving the
 * create-artist flow itself, since which UI that opens is caller-specific.
 *
 * `onSelectionCleared` retracts an earlier `onSelect`: the artist id a caller
 * holds is only good for the exact text that produced it, so editing the field
 * after a pick invalidates it. Without the retraction a caller that keeps the
 * id would save the old link under text that no longer names that artist —
 * silently, since the field reads as whatever was typed last. It is required
 * rather than optional so that holding an id and never dropping it cannot be
 * reached by omission.
 */
export interface ArtistSearchTypeaheadProps {
  genreId: number;
  value: string;
  onChange: (value: string) => void;
  onSelect: (artist: ArtistInGenreOption) => void;
  onCreateNew: (searchTerm: string) => void;
  /**
   * Fired when the field's text is edited away from the artist last passed to
   * `onSelect`, once per selection. Callers holding that artist's id must drop
   * it here; a later `onSelect` arms the signal again.
   */
  onSelectionCleared: () => void;
  disabled?: boolean;
}

function ArtistSearchTypeaheadInner({
  genreId,
  value,
  onChange,
  onSelect,
  onCreateNew,
  onSelectionCleared,
  disabled,
}: ArtistSearchTypeaheadProps) {
  const [open, setOpen] = useState(false);
  const [rawHighlightIndex, setHighlightIndex] = useState(NO_HIGHLIGHT);
  // The artist the caller was last told about, held in a ref because nothing
  // rendered here depends on it — it exists only to decide, at the moment the
  // text is edited, whether that report is still true.
  const confirmedArtist = useRef<ArtistInGenreOption | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const trimmed = value.trim();
  const debouncedQuery = useDebouncedValue(trimmed, DEBOUNCE_MS);

  const hasValidQuery = trimmed.length >= MIN_QUERY_LENGTH;
  const debouncedIsValid = debouncedQuery.length >= MIN_QUERY_LENGTH;
  // Nothing to search for while the panel is shut: a form that seeds the field
  // with an already-linked artist must not fire a request on mount, and closing
  // the panel after a pick must not re-query for the name just written back.
  const skip = !open || !debouncedIsValid;

  // `currentData` is the payload for these exact args; `data` is the latest
  // payload for ANY args, falling back to the previous ones whenever the
  // current args are not in a success state. Reading `data` would therefore
  // serve the previous genre's or query's rows for the whole in-flight window
  // after the args change, and permanently on args that error — rows the user
  // can pick while the caller believes it is filing under the new genre.
  const {
    currentData: data,
    isFetching,
    isError,
    refetch,
  } = useSearchArtistsInGenreQuery(
    { genre_id: genreId, q: debouncedQuery, limit: RESULT_LIMIT },
    { skip },
  );

  // The response is keyed to `genreId` and the DEBOUNCED query, so a genre swap
  // or a new query string drops the previous rows on its own. The remaining
  // stale window is the debounce itself, where the live text has already moved
  // on: gate on the live value so backspacing below the minimum length, or
  // retyping from scratch, clears the old rows immediately instead of leaving
  // them selectable under text that no longer produced them.
  const pendingDebounce = hasValidQuery && debouncedQuery !== trimmed;
  const resultsAreCurrent = hasValidQuery && !pendingDebounce && !skip;
  const artists = resultsAreCurrent ? (data?.artists ?? NO_ARTISTS) : NO_ARTISTS;

  const showPanel = open && hasValidQuery;
  const isSearching = showPanel && (pendingDebounce || isFetching);
  // A search that failed outright has no answer about existing artists, so it
  // gets its own presentation rather than passing for "no matches". A failed
  // refetch that still has a prior response for these exact args keeps showing
  // that response instead — which is what the arg-scoped `data` above buys: an
  // earlier query's payload must never suppress this query's error panel.
  const showError = resultsAreCurrent && isError && data === undefined;
  // Until the first rows land there is nothing to offer but "create new", and
  // offering it against results that have not arrived is how a typeahead built
  // to prevent duplicate artists ends up producing them. The panel reports
  // progress instead, and the keyboard has no row to act on.
  const showSearching = isSearching && artists.length === 0 && !showError;
  const showListbox = showPanel && !showError && !showSearching;

  // A shorter later response can leave the highlight pointing past the end of
  // the list. Clamping at render time keeps highlight and rows in step without
  // a corrective state write. Every index the list no longer has — including
  // the one exactly one past the end — comes back to the last ARTIST row, and
  // to NO_HIGHLIGHT when the list is empty, so a shrinking result set can never
  // park the highlight on a row that is not there. The sentinels are negative
  // and so pass through untouched: an explicit "create new" highlight survives
  // a shrink, since the user chose it rather than drifting onto it.
  const highlightIndex =
    rawHighlightIndex >= artists.length ? artists.length - 1 : rawHighlightIndex;
  const createIndex = artists.length;
  const createHighlighted = highlightIndex === CREATE_HIGHLIGHT;

  const openPanel = useCallback(() => {
    if (disabled) return;
    // Idempotent by construction — it touches nothing but `open`. Clicking an
    // already-focused input does not refire `onFocus`, so `onClick` has to be
    // able to run over an open panel without disturbing the live query or the
    // current highlight.
    setOpen(true);
  }, [disabled]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setHighlightIndex(NO_HIGHLIGHT);
  }, []);

  const handleSelect = useCallback(
    (artist: ArtistInGenreOption) => {
      confirmedArtist.current = artist;
      // `onChange` runs first so that a caller which rewrites `value` from
      // inside `onSelect` writes last and wins.
      onChange(artist.artist_name);
      onSelect(artist);
      closePanel();
    },
    [onChange, onSelect, closePanel],
  );

  const handleTextEdit = useCallback(
    (next: string) => {
      onChange(next);
      // Text that no longer names the confirmed artist retracts it, and only
      // once: the caller has dropped the id by the second keystroke, and a
      // repeated retraction would read as a second, unrelated event.
      if (
        confirmedArtist.current &&
        next.trim() !== confirmedArtist.current.artist_name
      ) {
        confirmedArtist.current = null;
        onSelectionCleared();
      }
      setOpen(true);
      setHighlightIndex(NO_HIGHLIGHT);
    },
    [onChange, onSelectionCleared],
  );

  const handleCreateNew = useCallback(() => {
    onCreateNew(trimmed);
    closePanel();
  }, [onCreateNew, trimmed, closePanel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape dismisses any open panel, including the error and in-progress
      // states that have no rows to navigate.
      if (e.key === "Escape" && showPanel) {
        e.preventDefault();
        closePanel();
        inputRef.current?.blur();
        return;
      }
      if (!showListbox) return;
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          // "create new" is the last row, so arrowing down from it stays put
          // rather than wrapping back to the first result.
          if (createHighlighted) break;
          const next = highlightIndex + 1;
          setHighlightIndex(next >= artists.length ? CREATE_HIGHLIGHT : next);
          break;
        }
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex(
            createHighlighted
              ? artists.length - 1
              : Math.max(highlightIndex - 1, NO_HIGHLIGHT),
          );
          break;
        case "Enter":
          e.preventDefault();
          if (createHighlighted) {
            handleCreateNew();
          } else if (highlightIndex >= 0) {
            handleSelect(artists[highlightIndex]);
          }
          break;
      }
    },
    [
      showPanel,
      showListbox,
      highlightIndex,
      createHighlighted,
      artists,
      handleSelect,
      handleCreateNew,
      closePanel,
    ],
  );

  const rowSx = (highlighted: boolean) => ({
    px: 1.5,
    py: 0.75,
    cursor: "pointer",
    backgroundColor: highlighted ? "primary.700" : "transparent",
    "&:hover": {
      backgroundColor: highlighted ? "primary.700" : "neutral.800",
    },
  });

  return (
    // Every close goes through `closePanel`: a close that left the highlight
    // standing would reopen the panel pre-highlighted, turning the next Enter
    // into a selection the user never navigated to.
    <ClickAwayListener onClickAway={closePanel}>
      <Box sx={{ position: "relative", width: "100%" }}>
        <Input
          size="sm"
          fullWidth
          disabled={disabled}
          placeholder="Search artists..."
          value={value}
          onFocus={openPanel}
          onClick={openPanel}
          onChange={(e) => handleTextEdit(e.target.value)}
          onKeyDown={handleKeyDown}
          startDecorator={
            isSearching ? (
              <CircularProgress
                size="sm"
                sx={{ "--CircularProgress-size": "14px" }}
              />
            ) : undefined
          }
          slotProps={{
            input: {
              ref: inputRef,
              role: "combobox",
              "aria-label": "Search artists",
              // All three reference or describe the listbox, which only exists
              // while `showListbox` holds — an unconditional `aria-controls`
              // would leave a dangling IDREF whenever the panel is shut or the
              // search failed.
              "aria-expanded": showListbox,
              "aria-controls": showListbox ? listboxId : undefined,
              // The create row is the last option in DOM order, so it carries
              // the option id one past the last result even though the
              // highlight itself is held as a sentinel.
              "aria-activedescendant":
                showListbox && createHighlighted
                  ? `${listboxId}-option-${createIndex}`
                  : showListbox && highlightIndex >= 0
                    ? `${listboxId}-option-${highlightIndex}`
                    : undefined,
              "aria-autocomplete": "list",
              autoComplete: "off",
              spellCheck: false,
            },
          }}
        />

        {showPanel && (
          <Sheet
            variant="outlined"
            {...(showError
              ? { role: "alert" as const }
              : showSearching
                ? { role: "status" as const }
                : { role: "listbox" as const, id: listboxId })}
            sx={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 8002,
              borderRadius: "md",
              maxHeight: "300px",
              overflowY: "auto",
              boxShadow: "0px 8px 24px -4px rgba(0,0,0,0.4)",
              py: 0.5,
            }}
          >
            {showError ? (
              // A failed search is not evidence that the artist is missing, so
              // it must not offer creation as the way out — that would turn an
              // outage into duplicate catalog rows.
              <Box sx={{ px: 1.5, py: 0.75 }}>
                <Typography level="body-sm">
                  Artist search is unavailable. Existing artists can&apos;t be
                  checked right now.
                </Typography>
                <Button
                  size="sm"
                  variant="plain"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => refetch()}
                  sx={{ mt: 0.5, px: 0 }}
                >
                  Try again
                </Button>
              </Box>
            ) : showSearching ? (
              <Box sx={{ px: 1.5, py: 0.75 }}>
                <Typography level="body-sm" sx={{ fontStyle: "italic" }}>
                  Searching artists...
                </Typography>
              </Box>
            ) : (
              <>
                {artists.map((artist, index) => (
                  <Box
                    key={artist.id}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={highlightIndex === index}
                    // preventDefault keeps focus on the input so neither the
                    // click-away nor the blur path closes the panel before this
                    // row's `onClick` selection handler runs.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(artist)}
                    onMouseEnter={() => setHighlightIndex(index)}
                    sx={rowSx(highlightIndex === index)}
                  >
                    <Typography
                      level="body-sm"
                      sx={{
                        color: highlightIndex === index ? "white" : "inherit",
                      }}
                    >
                      {artist.artist_name}
                    </Typography>
                  </Box>
                ))}
                <Box
                  id={`${listboxId}-option-${createIndex}`}
                  role="option"
                  aria-selected={createHighlighted}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCreateNew}
                  onMouseEnter={() => setHighlightIndex(CREATE_HIGHLIGHT)}
                  sx={{
                    ...rowSx(createHighlighted),
                    borderTop: artists.length > 0 ? "1px solid" : undefined,
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    level="body-sm"
                    sx={{
                      fontStyle: "italic",
                      color: createHighlighted ? "white" : "inherit",
                    }}
                  >
                    {artists.length === 0
                      ? `Create new artist "${trimmed}"`
                      : `Create new artist "${trimmed}" instead`}
                  </Typography>
                </Box>
              </>
            )}
          </Sheet>
        )}
      </Box>
    </ClickAwayListener>
  );
}

export default function ArtistSearchTypeahead(props: ArtistSearchTypeaheadProps) {
  return (
    <RequireMD>
      <ArtistSearchTypeaheadInner {...props} />
    </RequireMD>
  );
}
