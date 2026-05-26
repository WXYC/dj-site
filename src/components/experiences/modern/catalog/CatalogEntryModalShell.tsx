"use client";

import { useCatalogAlbumNavigation } from "@/src/hooks/useCatalogAlbumNavigation";
import ContentCopy from "@mui/icons-material/ContentCopy";
import {
  Box,
  DialogContent,
  DialogTitle,
  IconButton,
  Modal,
  ModalClose,
  ModalDialog,
  Stack,
  Tooltip,
} from "@mui/joy";
import { ReactNode, useCallback } from "react";
import { toast } from "sonner";
import { CATALOG_MODAL_Z_INDEX } from "./form/catalogModalLayers";
import {
  catalogFormDialogContentSx,
  catalogFormDialogSx,
} from "./form/catalogFormLayout";

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

/** Space for absolutely positioned ModalClose (top-right). */
const HEADER_CLOSE_INSET = "2.75rem";

type CatalogEntryModalShellProps = {
  variant: CatalogEntryModalVariant;
  children: ReactNode;
  headerActions?: ReactNode;
  showCopyLink?: boolean;
  closeAriaLabel?: string;
  size?: "view" | "form";
};

export default function CatalogEntryModalShell({
  variant,
  children,
  headerActions,
  showCopyLink = variant !== "add",
  closeAriaLabel,
  size,
}: CatalogEntryModalShellProps) {
  const { closeAlbum } = useCatalogAlbumNavigation();
  const dialogSize = size ?? (variant === "view" ? "view" : "form");
  const isFormDialog = dialogSize === "form";

  const handleClose = useCallback(() => {
    closeAlbum();
  }, [closeAlbum]);

  const handleCopyPermalink = useCallback(async () => {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Permalink copied");
  }, []);

  const titleId = `${TEST_IDS[variant]}-title`;

  return (
    <Modal
      open
      onClose={handleClose}
      sx={{
        zIndex: CATALOG_MODAL_Z_INDEX,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ModalDialog
        variant="plain"
        aria-labelledby={isFormDialog ? undefined : titleId}
        data-testid={TEST_IDS[variant]}
        layout="center"
        sx={{
          width: isFormDialog ? "min(100%, 600px)" : "min(100%, 520px)",
          maxHeight: "min(90dvh, 720px)",
          mx: 1,
          borderRadius: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          p: 0,
          ...catalogFormDialogSx,
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <ModalClose
            aria-label={closeAriaLabel ?? `Close ${TITLES[variant].toLowerCase()}`}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 2,
            }}
          />

          {!isFormDialog ? (
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              spacing={1}
              sx={{
                px: 2,
                pt: 2,
                pb: 0,
                flexShrink: 0,
                pr: HEADER_CLOSE_INSET,
              }}
            >
              <DialogTitle id={titleId} sx={{ p: 0, flex: 1, minWidth: 0 }}>
                {TITLES[variant]}
              </DialogTitle>
              {showCopyLink || headerActions ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ flexShrink: 0 }}
                >
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
                </Stack>
              ) : null}
            </Stack>
          ) : variant === "edit" && showCopyLink ? (
            <Stack
              direction="row"
              justifyContent="flex-end"
              sx={{
                px: 1.5,
                pt: 1.5,
                flexShrink: 0,
                pr: HEADER_CLOSE_INSET,
              }}
            >
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
            </Stack>
          ) : null}

          <DialogContent sx={catalogFormDialogContentSx}>
            {children}
          </DialogContent>
        </Box>
      </ModalDialog>
    </Modal>
  );
}
