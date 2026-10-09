"use client";

import { useState } from "react";
import { Button, Input, Stack, Typography } from "@mui/joy";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intakeItem;

/**
 * Searches the catalog the way the classic catalog does (the term as both artist and title, so a compilation
 * or a title search is found) and hands back the release the person picks; it files nothing. `selectedId`
 * marks the picked row, and `onSearch` fires when a new search is submitted so the caller can drop a pick the
 * new rows no longer contain.
 */
export default function ReleasePicker({
  onPick,
  selectedId = null,
  onSearch,
}: {
  onPick: (release: AlbumEntry) => void;
  selectedId?: number | null;
  onSearch?: () => void;
}) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const results = useSearchCatalogQuery({ artist_name: term, album_title: term, n: 50 }, { skip: term === "" });

  return (
    <Stack spacing={1}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch?.();
          setTerm(text.trim());
        }}
      >
        <Stack direction="row" spacing={1}>
          <Input type="search" slotProps={{ input: { "aria-label": COPY.searchLibrary } }} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit">{COPY.search}</Button>
        </Stack>
      </form>
      {/* Both read the current term only: `data` carries the previous term's rows over. */}
      {results.isError && <Typography role="alert">{COPY.searchFailed}</Typography>}
      {results.currentData?.map((release) => (
        <Button
          key={release.id}
          variant={release.id === selectedId ? "soft" : "plain"}
          color={release.id === selectedId ? "primary" : "neutral"}
          aria-pressed={release.id === selectedId}
          onClick={() => onPick(release)}
          sx={{ justifyContent: "flex-start" }}
        >
          {COPY.recordLine(release.artist.name, release.title, release.format)}
        </Button>
      ))}
    </Stack>
  );
}
