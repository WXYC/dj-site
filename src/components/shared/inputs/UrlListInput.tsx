"use client";

import { useEffect, useRef, useState } from "react";
import { Add, Remove } from "@mui/icons-material";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";

export interface UrlListInputProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

const PLACEHOLDER = "bandcamp.com, discogs.com, etc.";

/**
 * Dynamic URL rows emitting `string[]`. Values carry no scheme guarantee --
 * an MD pastes a bare domain as often as a full URL -- so nothing here may
 * ever render one as a clickable href.
 *
 * Keeps its own row list (blanks included) rather than deriving it from
 * `value` on every render: `value` never carries the blank row a user is
 * mid-way through typing, so re-deriving from it would erase that row the
 * instant a sibling edit round-trips through the parent's onChange.
 */
function UrlListInput({ value, onChange }: UrlListInputProps) {
  const [rows, setRows] = useState<string[]>(value.length ? value : [""]);
  // Distinguishes an external reset (parent handed back a `value` this
  // component didn't itself just emit) from the routine round-trip after its
  // own onChange, which must not overwrite an in-progress blank row.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setRows(value.length ? value : [""]);
  }, [value]);

  function commit(nextRows: string[]) {
    setRows(nextRows);
    const emitted = nextRows.filter((url) => url.trim() !== "");
    lastEmitted.current = emitted;
    onChange(emitted);
  }

  return (
    <Stack spacing={1}>
      {rows.map((row, index) => (
        <Stack key={index} direction="row" spacing={1}>
          <Input
            value={row}
            placeholder={PLACEHOLDER}
            onChange={(e) =>
              commit(rows.map((r, i) => (i === index ? e.target.value : r)))
            }
            sx={{ flexGrow: 1 }}
          />
          {rows.length > 1 && (
            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              aria-label="Remove this URL"
              onClick={() => commit(rows.filter((_, i) => i !== index))}
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
              onClick={() => commit([...rows, ""])}
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
