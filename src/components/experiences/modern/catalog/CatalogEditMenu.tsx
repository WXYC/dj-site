"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { Add } from "@mui/icons-material";
import { Button } from "@mui/joy";
import { useEffect, useState } from "react";

export default function CatalogEditMenu() {
  const dispatch = useAppDispatch();
  const canEdit = useCanEditCatalog();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth and Joy Button markup are resolved on the client; defer until mounted
  // so SSR and the first hydration pass both render null (see Welcome.tsx).
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
      onClick={() =>
        dispatch(
          applicationSlice.actions.openPanel({
            type: "admin-catalog-add-entry",
          })
        )
      }
    >
      Add
    </Button>
  );
}
