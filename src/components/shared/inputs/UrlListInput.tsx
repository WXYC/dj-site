"use client";

import { useRef, useState } from "react";
import { Add, Remove } from "@mui/icons-material";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";

export interface UrlListInputProps {
  /**
   * Current urls. Entries carry no scheme guarantee and no validation of any
   * kind -- an MD pastes a bare domain as often as a full URL, and nothing
   * stops `javascript:` either -- so consumers must never render one as a
   * clickable href (or otherwise treat it as a safe URL) without validating
   * it first. Referential stability is not required: external changes are
   * detected by content, so a freshly-derived array is fine.
   */
  value: string[];
  /** Receives the non-blank rows on every edit. Same no-href caveat as `value`. */
  onChange: (urls: string[]) => void;
}

const PLACEHOLDER = "bandcamp.com, discogs.com, etc.";

/** A row's identity survives edits and removals of its siblings, so DOM state (focus, caret, composition) stays with the logical row it belongs to. */
type UrlRow = { id: number; url: string };

const serialize = (urls: string[]) => JSON.stringify(urls);

/**
 * Dynamic URL rows emitting `string[]` (see `UrlListInputProps` for the
 * no-clickable-href contract on the values).
 *
 * Keeps its own row list (blanks included) rather than deriving it from
 * `value` on every render: `value` never carries the blank row a user is
 * mid-way through typing, so re-deriving from it would erase that row the
 * instant a sibling edit round-trips through the parent's onChange.
 */
function UrlListInput({ value, onChange }: UrlListInputProps) {
  // Monotonic row-id source. Advancing it during render (initial state and
  // the reset below) is benign non-idempotence: a discarded render only
  // skips ids, and uniqueness is all the keys need.
  const nextIdRef = useRef(0);
  const makeRows = (urls: string[]): UrlRow[] =>
    (urls.length ? urls : [""]).map((url) => ({ id: nextIdRef.current++, url }));

  const [rows, setRows] = useState<UrlRow[]>(() => makeRows(value));
  // The url list this component and its parent last agreed on, by content --
  // never by reference, which the props deliberately promise nothing about.
  const [syncedKey, setSyncedKey] = useState(() => serialize(value));

  // External reset vs round-trip: a `value` whose content matches what we
  // last emitted (or last reset to) is our own onChange coming back and must
  // not erase an in-progress blank row; anything else means the parent
  // changed the list out from under us (hydration, clear, a transforming
  // round-trip like trimming), and the rows rebuild from it during render
  // per React's adjust-state-on-prop-change pattern -- no effect, no
  // identity contract. Row ids are reused positionally so a row whose
  // content merely changed keeps its DOM node -- and the user's focus and
  // caret, which a trimming parent would otherwise steal mid-typing; only
  // rows past the current count get fresh ids.
  const valueKey = serialize(value);
  if (valueKey !== syncedKey) {
    setSyncedKey(valueKey);
    const urls = value.length ? value : [""];
    setRows(urls.map((url, index) => ({ id: rows[index]?.id ?? nextIdRef.current++, url })));
  }

  function commit(nextRows: UrlRow[]) {
    setRows(nextRows);
    const emitted = nextRows.map((row) => row.url).filter((url) => url.trim() !== "");
    setSyncedKey(serialize(emitted));
    onChange(emitted);
  }

  return (
    <Stack spacing={1}>
      {rows.map((row, index) => (
        <Stack key={row.id} direction="row" spacing={1}>
          <Input
            value={row.url}
            slotProps={{ input: { "aria-label": `URL ${index + 1}` } }}
            placeholder={PLACEHOLDER}
            onChange={(e) =>
              commit(rows.map((r) => (r.id === row.id ? { ...r, url: e.target.value } : r)))
            }
            sx={{ flexGrow: 1 }}
          />
          {rows.length > 1 && (
            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              aria-label={`Remove URL ${index + 1}`}
              onClick={() => commit(rows.filter((r) => r.id !== row.id))}
            >
              <Remove />
            </IconButton>
          )}
          {index === rows.length - 1 && (
            <IconButton
              size="sm"
              variant="plain"
              color="primary"
              aria-label="Add another URL"
              onClick={() => commit([...rows, { id: nextIdRef.current++, url: "" }])}
            >
              <Add />
            </IconButton>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

export default UrlListInput;
