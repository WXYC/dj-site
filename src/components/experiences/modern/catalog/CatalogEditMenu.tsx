"use client";

import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { useCatalogAlbumNavigation } from "@/src/hooks/useCatalogAlbumNavigation";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/joy";
import { useEffect, useState } from "react";

export default function CatalogEditMenu() {
  const { openAlbumAdd } = useCatalogAlbumNavigation();
  const canEdit = useCanEditCatalog();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !canEdit) {
    return null;
  }

  return (
    <Button
      variant="outlined"
      color="success"
      size="sm"
      startDecorator={<Add />}
      data-testid="catalog-add-button"
      aria-label="Add to catalog"
      onClick={() => openAlbumAdd()}
    >
      Add
    </Button>
  );
}
