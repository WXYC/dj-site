"use client";

import {
  albumInfoRequestFromRouteId,
  catalogAlbumPath,
} from "@/lib/features/catalog/libraryCode";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import CatalogEntryEditSections, {
  type CatalogEditFooterState,
} from "../admin/catalog/CatalogEntryEditSections";
import AlbumErrorCard from "../Rightbar/panels/album/AlbumErrorCard";
import AlbumLoadingCard from "../Rightbar/panels/album/AlbumLoadingCard";
import { Button } from "@mui/joy";
import { useAlbumDetailContent } from "./album/useAlbumDetailContent";
import CatalogEntryModalShell from "./CatalogEntryModalShell";
import CatalogEditContextHeader from "./form/CatalogEditContextHeader";

export default function CatalogAlbumEditModal() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const routeId = params.id ?? "";
  const infoRequest = useMemo(
    () => (routeId ? albumInfoRequestFromRouteId(routeId) : null),
    [routeId],
  );

  const saveHandlerRef = useRef<() => void>(() => {});
  const [canSave, setCanSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    editSessionKey,
    setDraftCodePreview,
    isLoading,
    isError,
    album,
    albumId,
    artworkUrl,
    codePreview,
  } = useAlbumDetailContent(infoRequest, "edit");

  const handleFooterChange = useCallback((footer: CatalogEditFooterState) => {
    saveHandlerRef.current = footer.onSave;
    setCanSave((prev) => (prev === footer.canSave ? prev : footer.canSave));
    setSaving((prev) => (prev === footer.saving ? prev : footer.saving));
  }, []);

  if (!infoRequest) {
    return null;
  }

  const footer =
    !isLoading && !isError && album && albumId !== undefined ? (
      <Button
        variant="solid"
        color="primary"
        loading={saving}
        disabled={!canSave || saving}
        onClick={() => {
          void saveHandlerRef.current();
        }}
        data-testid="catalog-edit-save-button"
      >
        {saving ? "Saving…" : "Save changes"}
      </Button>
    ) : null;

  const aboveBody =
    !isLoading &&
    !isError &&
    album &&
    albumId !== undefined &&
    codePreview ? (
      <CatalogEditContextHeader
        album={album}
        artworkUrl={artworkUrl}
        codePreview={codePreview}
      />
    ) : null;

  return (
    <CatalogEntryModalShell
      variant="edit"
      size="form"
      closeAriaLabel="Close edit catalog entry"
      aboveBody={aboveBody}
      footer={footer}
    >
      {isLoading ? (
        <AlbumLoadingCard />
      ) : isError || !album || albumId === undefined ? (
        <AlbumErrorCard />
      ) : (
        <CatalogEntryEditSections
          key={editSessionKey}
          albumId={albumId}
          album={album}
          onCodePreviewChange={setDraftCodePreview}
          onFooterChange={handleFooterChange}
          onSaveSuccess={() => {
            router.replace(catalogAlbumPath(routeId), { scroll: false });
          }}
        />
      )}
    </CatalogEntryModalShell>
  );
}
