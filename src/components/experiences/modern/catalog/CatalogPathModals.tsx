"use client";

import {
  isCatalogAddPath,
  isCatalogAlbumEditPath,
  isCatalogAlbumViewPath,
} from "@/lib/features/catalog/libraryCode";
import { usePathname } from "next/navigation";
import CatalogAlbumAddModal from "./CatalogAlbumAddModal";
import CatalogAlbumEditModal from "./CatalogAlbumEditModal";
import CatalogAlbumViewModal from "./CatalogAlbumViewModal";

/**
 * Renders catalog modals when the URL matches view/edit/add paths.
 * Mounted in CatalogExperience as a fallback when the @information parallel
 * slot does not intercept; modals use fixed test ids so only one should mount.
 */
export default function CatalogPathModals() {
  const pathname = usePathname() ?? "";

  if (isCatalogAddPath(pathname)) {
    return <CatalogAlbumAddModal />;
  }
  if (isCatalogAlbumEditPath(pathname)) {
    return <CatalogAlbumEditModal />;
  }
  if (isCatalogAlbumViewPath(pathname)) {
    return <CatalogAlbumViewModal />;
  }
  return null;
}
