"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppSelector } from "@/lib/hooks";
import { Troubleshoot } from "@mui/icons-material";
import {
  Box,
  Button,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { useState } from "react";
import FlowsheetSearchSegment from "./FlowsheetSearchSegment";

export default function MobileFlowsheetEntry({
  live,
  children,
}: {
  live: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const preview =
    [searchQuery.artist, searchQuery.song, searchQuery.album]
      .filter(Boolean)
      .join(" — ") || "Log a track…";

  return (
    <>
      <Sheet
        sx={{
          display: { xs: "flex", md: "none" },
          my: 1,
          background: "transparent",
        }}
      >
        <Button
          size="lg"
          variant="outlined"
          disabled={!live}
          onClick={() => setOpen(true)}
          data-testid="flowsheet-mobile-summary"
          startDecorator={<Troubleshoot />}
          sx={{
            flexGrow: 1,
            justifyContent: "flex-start",
            minHeight: "48px",
            fontWeight: "normal",
            color: preview === "Log a track…" ? "text.tertiary" : "text.primary",
          }}
        >
          <Typography level="body-sm" noWrap sx={{ flex: 1, textAlign: "left" }}>
            {preview}
          </Typography>
        </Button>
      </Sheet>

      <Box sx={{ display: { xs: "none", md: "block" } }}>{children}</Box>

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog layout="fullscreen" aria-labelledby="flowsheet-mobile-entry">
          <ModalClose />
          <Stack spacing={2} sx={{ pt: 2, flex: 1 }}>
            <Typography id="flowsheet-mobile-entry" level="h4">
              Log a track
            </Typography>
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              <FlowsheetSearchSegment name="artist" label="Artist" disabled={!live} />
              <FlowsheetSearchSegment name="song" label="Song" disabled={!live} required />
              <FlowsheetSearchSegment name="album" label="Album" disabled={!live} />
              <FlowsheetSearchSegment name="label" label="Label" disabled={!live} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ position: "sticky", bottom: 0, py: 2 }}>
              <Button
                size="lg"
                color="primary"
                sx={{ flex: 1, minHeight: "48px" }}
                data-testid="flowsheet-mobile-play"
                onClick={() => setOpen(false)}
              >
                Play
              </Button>
              <Button
                size="lg"
                color="success"
                variant="outlined"
                sx={{ flex: 1, minHeight: "48px" }}
                data-testid="flowsheet-mobile-queue"
                onClick={() => setOpen(false)}
              >
                Queue
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </>
  );
}
