"use client";

import { useEffect, useId, useMemo } from "react";
import { useSearchLabelsQuery } from "@/lib/features/labels/api";
import type { Label } from "@/lib/features/labels/types";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;
// Stable identity so an empty result does not re-run the exact-match effect.
const NO_LABELS: Label[] = [];

/**
 * Classic equivalent of `rotationReleaseInsert.jsp`'s `companyName` field,
 * which wires `setUpCompanyAutocomplete({url: 'companyAutocomplete'})`
 * (`autocomplete-wrappers.ts`) -- a plain `<input list>` bound to a
 * `<datalist>` the JSP populates from a fetch, with a hidden `companyID`
 * field the browser fills in on an exact text match. That is deliberately
 * the interaction model reproduced here (`Do not modernize interactions`):
 * a native input/datalist pair, not the modern `LabelSearchTypeahead`'s
 * custom listbox (MUI, keyboard-navigable, arrow-key highlight) -- that
 * component exists because its caller needs a `label_id` on the wire
 * (`AddReleasePanel`); the free-text rotation add this feeds submits
 * `record_label` as a plain string, so there is no id to carry and no
 * reason to import the heavier interaction it was built for.
 *
 * One deliberate divergence from the JSP, forced by this codebase's own
 * outage-rendering convention: `autocomplete-wrappers.ts`'s fetch failure
 * path is a bare `console.error` -- an outage there silently reads as "no
 * matches yet", indistinguishable from an MD who simply hasn't typed enough
 * of the name. `searchLabels` opts out of the shared backend query's
 * soft-JSON-failure handling for exactly this reason (see its own doc
 * comment), so a failed search surfaces here as `isError` rather than an
 * empty option list, and this component renders a `role="alert"` panel
 * distinct from "still typing" or "no existing label" for it.
 *
 * `onSelect` fires when the typed text names a label that already exists,
 * which is how the caller canonicalizes "sonamos" to the stored "Sonamos"
 * before submitting it as free text. There is no matching "selection
 * cleared" callback because there is no selection to clear: the JSP's
 * hidden `companyID` has no counterpart on `POST /library/rotation`, whose
 * uncatalogued path takes `record_label` as a string and no label id, so
 * the typed text is always already the value that will be sent.
 */
export interface CompanyAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (label: Label) => void;
  disabled?: boolean;
}

export default function CompanyAutocomplete({
  value,
  onChange,
  onSelect,
  disabled,
}: CompanyAutocompleteProps) {
  const datalistId = useId();

  const trimmed = value.trim();
  const debouncedQuery = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const hasValidQuery = debouncedQuery.length >= MIN_QUERY_LENGTH;
  const skip = Boolean(disabled) || !hasValidQuery;

  // `currentData`, not `data`: `data` holds the last result for ANY args, so
  // between keystrokes it still carries the previous query's labels. The
  // datalist would go on offering them for a prefix that no longer matches,
  // and the exact-match check below would run against a stale list.
  const {
    currentData: data,
    isError,
    isFetching,
    refetch,
  } = useSearchLabelsQuery({ q: debouncedQuery, limit: RESULT_LIMIT }, { skip });

  const labels = useMemo(() => data ?? NO_LABELS, [data]);
  const showError = hasValidQuery && !skip && isError;

  function exactMatch(text: string, candidates: Label[]): Label | undefined {
    const folded = text.trim().toLowerCase();
    return candidates.find((label) => label.label_name.trim().toLowerCase() === folded);
  }

  const handleChange = (next: string) => {
    onChange(next);
    // Mirrors `DatalistAutocomplete.handleInput`'s exact-match check: the
    // JSP treats the typed text as naming an existing company only when it
    // matches a loaded option exactly (case-insensitive, trimmed).
    const match = exactMatch(next, labels);
    if (match) onSelect(match);
  };

  // Mirrors `DatalistAutocomplete.handleInput`'s post-fetch re-check: typing
  // finishes, and only after the debounce + request settle does the search
  // result exist to compare against -- a keystroke that exactly typed an
  // existing label's name can't discover the match at keystroke time, since
  // `labels` for that name hasn't loaded yet. This synchronizes the
  // confirmed selection with the external search result once it arrives, an
  // external system (the search response) this component has no other way
  // to learn about.
  useEffect(() => {
    if (skip) return;
    const match = exactMatch(value, labels);
    if (match) onSelect(match);
  }, [labels, value, skip, onSelect]);

  return (
    <span style={{ display: "inline-block" }}>
      <input
        type="text"
        aria-label="Record Label"
        list={datalistId}
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        size={50}
        autoComplete="off"
      />
      <datalist id={datalistId}>
        {labels.map((label) => (
          <option key={label.id} value={label.label_name} />
        ))}
      </datalist>
      {showError && (
        <span role="alert" className="artist-error-message">
          Label search is unavailable, so existing labels can&apos;t be checked right now.{" "}
          <button type="button" disabled={isFetching} onClick={() => refetch()}>
            Try again
          </button>
        </span>
      )}
    </span>
  );
}
