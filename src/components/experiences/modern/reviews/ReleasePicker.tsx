"use client";

import { useState } from "react";
import { Button, Input, Stack, Typography } from "@mui/joy";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intakeItem;

/** Searches the catalog by artist and hands back the release the person picks; it files nothing. */
export default function ReleasePicker({ onPick }: { onPick: (release: AlbumEntry) => void }) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const results = useSearchCatalogQuery({ artist_name: term, album_title: undefined, n: 10 }, { skip: term === "" });

  return (
    <Stack spacing={1}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(text.trim());
        }}
      >
        <Stack direction="row" spacing={1}>
          <Input type="search" slotProps={{ input: { "aria-label": COPY.searchLibrary } }} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit">{COPY.search}</Button>
        </Stack>
      </form>
      {hasNothingToShow(results) && <Typography role="alert">{COPY.searchFailed}</Typography>}
      {results.data?.map((release) => (
        <Button key={release.id} variant="plain" onClick={() => onPick(release)} sx={{ justifyContent: "flex-start" }}>
          {release.artist.name} — {release.title}
        </Button>
      ))}
    </Stack>
  );
}
