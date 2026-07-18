"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import {
  albumDetailHref,
  parseAlbumIdFromPathname,
} from "@/lib/features/catalog/albumRoutes";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ALBUM_DOCK_QUERY } from "./dock";

/**
 * The one way to open an album's card from any trigger (catalog rows,
 * flowsheet entries, bin, rail tiles). A pinned album surfaces its docked
 * pane immediately — crucially also when its URL is already the current one,
 * where a bare push would be a no-op and nothing would appear. Unpinned
 * albums open as the modal via navigation.
 */
export default function useOpenAlbumDetail(): (albumId: number) => void {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);
  const isDesktop = useMediaQuery(ALBUM_DOCK_QUERY);

  return useCallback(
    (albumId: number) => {
      if (isDesktop && pinnedAlbumIds.includes(albumId)) {
        dispatch(applicationSlice.actions.openDockAlbum(albumId));
      }
      if (parseAlbumIdFromPathname(pathname) !== albumId) {
        router.push(albumDetailHref(pathname, albumId));
      }
    },
    [isDesktop, pinnedAlbumIds, pathname, dispatch, router],
  );
}
