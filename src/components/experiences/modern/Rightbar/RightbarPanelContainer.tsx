"use client";

import { Close } from "@mui/icons-material";
import { Box, Divider, IconButton, Stack, Typography } from "@mui/joy";

interface RightbarPanelContainerProps {
  title: string;
  subtitle?: string;
  startDecorator?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

export default function RightbarPanelContainer({
  title,
  subtitle,
  startDecorator,
  footer,
  onClose,
  children,
}: RightbarPanelContainerProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          {startDecorator}
          <Box sx={{ minWidth: 0 }}>
            <Typography level="title-md" noWrap>
              {title}
            </Typography>
            {subtitle && (
              <Typography level="body-sm" noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={onClose}
          aria-label="Close panel"
        >
          <Close />
        </IconButton>
      </Box>
      <Divider />

      {/* Scrollable content */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
        }}
      >
        {children}
      </Box>

      {/* Optional footer */}
      {footer && (
        <>
          <Divider />
          <Box sx={{ p: 2, flexShrink: 0 }}>
            {footer}
          </Box>
        </>
      )}
    </Box>
  );
}
