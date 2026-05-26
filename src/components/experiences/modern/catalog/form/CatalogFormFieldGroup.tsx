"use client";

import { Box, Divider } from "@mui/joy";
import type { ReactNode } from "react";
import { catalogFormGridSx } from "./catalogFormLayout";

type CatalogFormFieldGroupProps = {
  children: ReactNode;
  showDividerBefore?: boolean;
  disabled?: boolean;
  "data-testid"?: string;
};

export default function CatalogFormFieldGroup({
  children,
  showDividerBefore = false,
  disabled = false,
  "data-testid": dataTestId,
}: CatalogFormFieldGroupProps) {
  return (
    <Box
      data-testid={dataTestId}
      sx={{
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {showDividerBefore ? <Divider sx={{ mb: 2 }} /> : null}
      <Box sx={catalogFormGridSx}>{children}</Box>
    </Box>
  );
}
