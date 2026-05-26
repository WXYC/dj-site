"use client";

import {
  albumInfoRequestFromRouteId,
  catalogAlbumEditPath,
} from "@/lib/features/catalog/libraryCode";
import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { useCatalogAlbumNavigation } from "@/src/hooks/useCatalogAlbumNavigation";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { Button } from "@mui/joy";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import AlbumDetailContent from "./album/AlbumDetailContent";
import CatalogEntryModalShell from "./CatalogEntryModalShell";

export default function CatalogAlbumViewModal() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const canEditCatalog = useCanEditCatalog();
  const { openAlbumEdit } = useCatalogAlbumNavigation();

  const routeId = params.id ?? "";
  const infoRequest = useMemo(
    () => (routeId ? albumInfoRequestFromRouteId(routeId) : null),
    [routeId],
  );

  useEffect(() => {
    if (searchParams.get("mode") === "edit" && routeId) {
      router.replace(catalogAlbumEditPath(routeId));
    }
  }, [router, routeId, searchParams]);

  const handleStartEdit = useCallback(() => {
    if (!canEditCatalog || !routeId) return;
    openAlbumEdit(routeId);
  }, [canEditCatalog, openAlbumEdit, routeId]);

  if (!infoRequest) {
    return null;
  }

  const headerActions =
    canEditCatalog ? (
      <Button
        size="sm"
        variant="soft"
        color="success"
        startDecorator={<EditOutlined />}
        onClick={handleStartEdit}
        data-testid="album-detail-edit-button"
      >
        Edit
      </Button>
    ) : null;

  return (
    <CatalogEntryModalShell variant="view" size="view" headerActions={headerActions}>
      <AlbumDetailContent infoRequest={infoRequest} />
    </CatalogEntryModalShell>
  );
}
