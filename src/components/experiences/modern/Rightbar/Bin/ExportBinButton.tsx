"use client";

import { formatBinForExport } from "@/lib/features/bin/export";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { IosShare } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Writes the bin to the clipboard carrying both flavors: `text/html` (a real
 * table, so Google Docs / Sheets paste it as a table) and `text/plain` (TSV,
 * which Sheets splits into cells). Falls back to plain text on browsers without
 * the async `ClipboardItem` write.
 */
async function copyBinToClipboard(tsv: string, html: string): Promise<void> {
  const clipboard =
    typeof navigator !== "undefined" ? navigator.clipboard : undefined;

  if (
    clipboard &&
    typeof clipboard.write === "function" &&
    typeof ClipboardItem !== "undefined"
  ) {
    await clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([tsv], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
    return;
  }

  if (clipboard && typeof clipboard.writeText === "function") {
    await clipboard.writeText(tsv);
    return;
  }

  throw new Error("Clipboard unavailable");
}

/**
 * Header action that exports the whole Mail Bin. On devices with a native share
 * sheet (phones) it opens that first — the DJ can mail the list to themselves.
 * Everywhere else, and if sharing fails, it copies the bin to the clipboard as
 * a table with toast feedback. Rendered only when the bin is non-empty.
 */
export default function ExportBinButton({
  entries,
}: {
  entries: AlbumEntry[];
}) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (busy || entries.length === 0) return;
    setBusy(true);
    try {
      const { tsv, html, shareText } = formatBinForExport(entries);

      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({ title: "WXYC Mail Bin", text: shareText });
          return; // the native sheet is its own confirmation
        } catch (err) {
          // Dismissed the sheet: treat as a no-op rather than copying.
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }

      try {
        await copyBinToClipboard(tsv, html);
        toast.success("Mail Bin copied — paste it into an email or a doc");
      } catch {
        toast.error("Couldn't copy the Mail Bin");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip title="Export / Share Mail Bin" placement="top" variant="outlined">
      <IconButton
        variant="plain"
        color="neutral"
        size="sm"
        aria-label="Export Mail Bin"
        loading={busy}
        onClick={handleExport}
      >
        <IosShare />
      </IconButton>
    </Tooltip>
  );
}
