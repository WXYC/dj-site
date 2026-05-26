"use client";

import CatalogAlbumAddForm from "./CatalogAlbumAddForm";
import CatalogEntryModalShell from "./CatalogEntryModalShell";

export default function CatalogAlbumAddModal() {
  return (
    <CatalogEntryModalShell variant="add" showCopyLink={false}>
      <CatalogAlbumAddForm />
    </CatalogEntryModalShell>
  );
}
