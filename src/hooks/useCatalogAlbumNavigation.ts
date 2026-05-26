"use client";

import type { AlbumEntry } from "@/lib/features/catalog/types";
import {
  albumPermalinkSegment,
  catalogAlbumEditPath,
  catalogAlbumPath,
  CATALOG_ADD_PATH,
} from "@/lib/features/catalog/libraryCode";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useCatalogAlbumNavigation() {
  const router = useRouter();

  const openAlbum = useCallback(
    (albumOrId: AlbumEntry | number | string, options?: { replace?: boolean }) => {
      const segment =
        typeof albumOrId === "string"
          ? albumOrId
          : typeof albumOrId === "number"
            ? String(albumOrId)
            : albumPermalinkSegment(albumOrId);
      const path = catalogAlbumPath(segment);
      if (options?.replace) {
        router.replace(path, { scroll: false });
      } else {
        router.push(path, { scroll: false });
      }
    },
    [router],
  );

  const openAlbumEdit = useCallback(
    (albumOrId: AlbumEntry | number | string, options?: { replace?: boolean }) => {
      const segment =
        typeof albumOrId === "string"
          ? albumOrId
          : typeof albumOrId === "number"
            ? String(albumOrId)
            : albumPermalinkSegment(albumOrId);
      const path = catalogAlbumEditPath(segment);
      if (options?.replace) {
        router.replace(path, { scroll: false });
      } else {
        router.push(path, { scroll: false });
      }
    },
    [router],
  );

  const openAlbumAdd = useCallback(
    (options?: { replace?: boolean }) => {
      if (options?.replace) {
        router.replace(CATALOG_ADD_PATH, { scroll: false });
      } else {
        router.push(CATALOG_ADD_PATH, { scroll: false });
      }
    },
    [router],
  );

  const closeAlbum = useCallback(() => {
    router.back();
  }, [router]);

  return { openAlbum, openAlbumEdit, openAlbumAdd, closeAlbum };
}
