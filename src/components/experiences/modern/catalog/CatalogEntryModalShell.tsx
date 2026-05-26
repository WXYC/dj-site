"use client";

import { useCatalogAlbumNavigation } from "@/src/hooks/useCatalogAlbumNavigation";
import ContentCopy from "@mui/icons-material/ContentCopy";
import {
  Box,
  IconButton,
  Modal,
  ModalClose,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import { ReactNode, useCallback } from "react";
import { toast } from "sonner";

export type CatalogEntryModalVariant = "view" | "edit" | "add";

const TEST_IDS: Record<CatalogEntryModalVariant, string> = {
  view: "album-detail-modal",
  edit: "catalog-edit-modal",
  add: "catalog-add-modal",
};

const TITLES: Record<CatalogEntryModalVariant, string> = {
  view: "Album detail",
  edit: "Edit catalog entry",
  add: "Add catalog entry",
};

type CatalogEntryModalShellProps = {
  variant: CatalogEntryModalVariant;
  children: ReactNode;
  headerActions?: ReactNode;
  showCopyLink?: boolean;
  closeAriaLabel?: string;
};

export default function CatalogEntryModalShell({
  variant,
  children,
  headerActions,
  showCopyLink = variant !== "add",
  closeAriaLabel,
}: CatalogEntryModalShellProps) {
  const { closeAlbum } = useCatalogAlbumNavigation();

  const handleClose = useCallback(() => {
    closeAlbum();
  }, [closeAlbum]);

  const handleCopyPermalink = useCallback(async () => {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Permalink copied");
  }, []);

  return (
    <Modal
      open
      onClose={handleClose}
      data-testid={TEST_IDS[variant]}
      sx={{
        zIndex: 90000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          maxHeight: "min(90dvh, 900px)",
          overflow: "auto",
          width: "min(100%, 520px)",
          mx: 1,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1, px: 0.5 }}
        >
          <Typography level="title-md" data-testid={`${TEST_IDS[variant]}-title`}>
            {TITLES[variant]}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {showCopyLink ? (
              <Tooltip title="Copy permalink" variant="outlined" size="sm">
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  aria-label="Copy permalink"
                  onClick={handleCopyPermalink}
                  data-testid="album-detail-copy-link"
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {headerActions}
            <ModalClose
              aria-label={closeAriaLabel ?? `Close ${TITLES[variant].toLowerCase()}`}
            />
          </Stack>
        </Stack>
        {children}
      </Box>
    </Modal>
  );
}
