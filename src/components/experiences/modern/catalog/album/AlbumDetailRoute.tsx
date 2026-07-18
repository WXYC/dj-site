"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { useParams } from "next/navigation";
import { useEffect } from "react";
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

  const dispatch = useAppDispatch();
  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);
  const isDesktop = useMediaQuery(ALBUM_DOCK_QUERY);
  const isPinned = pinnedAlbumIds.includes(albumId);

  // Arriving at a pinned album's URL — rail click, catalog row, leftbar
  // carry-over — is the intent to view it, so the dock opens on that album.
  // A collapse without navigation never retriggers this: it lives here, not
  // in the dock, precisely so collapsed stays collapsed.
  useEffect(() => {
    if (isDesktop && isPinned) {
      dispatch(applicationSlice.actions.setDockView("album"));
    }
  }, [albumId, isPinned, isDesktop, dispatch]);

  if (isDesktop && isPinned) {
    return null;
  }

  return <AlbumDetailModal />;
}
