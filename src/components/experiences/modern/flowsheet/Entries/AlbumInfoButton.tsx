"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { InfoOutlined } from "@mui/icons-material";
import { IconButton } from "@mui/joy";
import { useRouter } from "next/navigation";

// Navigates with router.push and carries no href, so middle-click and
// open-in-new-tab do nothing on it.
export default function AlbumInfoButton({ entry }: { entry: FlowsheetSongEntry }) {
  const router = useRouter();

  return (
    <IconButton
      color="neutral"
      variant="plain"
      size="sm"
      disabled={!entry?.album_id || entry.album_id < 0}
      aria-label="Album information"
      onClick={() => router.push(`/dashboard/album/${entry.album_id}`)}
    >
      <InfoOutlined />
    </IconButton>
  );
}
