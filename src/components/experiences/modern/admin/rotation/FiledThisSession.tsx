"use client";

import type { JSX } from "react";
import Link from "next/link";
import { Sheet, Stack, Typography } from "@mui/joy";
import type { LibraryFilingResponse } from "@wxyc/shared";
import { ROTATION_BIN_LABELS } from "@/lib/features/rotation/types";

export interface FiledThisSessionProps {
  /** Successful filings in submission order, held by the bench for this mount only. */
  filings: LibraryFilingResponse[];
}

/**
 * Plain receipt for the sitting: every filing that succeeded since the bench
 * mounted, with a link into the rotation list. There is deliberately no retry
 * ledger here — `POST /library/filings` is transactional, so a refused or
 * failed submission filed nothing, partial success does not exist client-side,
 * and the failed attempt stays in the form fully editable rather than becoming
 * a row anywhere.
 */
export default function FiledThisSession({ filings }: FiledThisSessionProps): JSX.Element {
  return (
    <Sheet
      component="section"
      aria-label="Filed this session"
      variant="outlined"
      sx={{ p: 2, borderRadius: "md", minWidth: 260 }}
    >
      <Typography level="title-md" sx={{ mb: 1 }}>
        Filed this session
      </Typography>
      {filings.length === 0 ? (
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Nothing filed yet.
        </Typography>
      ) : (
        <Stack component="ul" spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {filings.map((filing) => (
            <li key={filing.release.id}>
              <Typography level="body-sm" fontWeight="lg">
                {filing.artist.artist_name} — {filing.release.album_title}
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                {filing.artist.code_letters} {filing.artist.code_artist_number}/
                {filing.release.code_number}
                {" · "}
                {filing.rotation
                  ? ROTATION_BIN_LABELS[filing.rotation.rotation_bin]
                  : "Library only"}
              </Typography>
            </li>
          ))}
        </Stack>
      )}
      <Typography level="body-sm" sx={{ mt: 1.5 }}>
        <Link href="/dashboard/admin/rotation">View in rotation list</Link>
      </Typography>
    </Sheet>
  );
}
