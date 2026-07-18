"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppSelector } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { useParams } from "next/navigation";
import AlbumDetailModal from "./AlbumDetailModal";
import { ALBUM_DOCK_QUERY } from "./dock";

/**
 * Route child for /dashboard/<page>/album/[id]. A pinned album renders as the
 * docked card next to the rail (owned by the Rightbar shell, which derives the
 * same id from the pathname), so this renders nothing; anything else — and
 * every viewport below the dock breakpoint — gets the centered modal.
 */
export default function AlbumDetailRoute() {
  const params = useParams<{ id: string }>();
  const albumId = Number(params.id);

  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);
  const isDesktop = useMediaQuery(ALBUM_DOCK_QUERY);

  if (isDesktop && pinnedAlbumIds.includes(albumId)) {
    return null;
  }

  return <AlbumDetailModal />;
}
