"use client";

import CatalogRotationBinPicker from "@/src/components/experiences/modern/admin/catalog/CatalogRotationBinPicker";
import type { Rotation } from "@/lib/features/rotation/types";
import { Box, Typography } from "@mui/joy";
import CatalogFormFieldGroup from "../CatalogFormFieldGroup";
import { catalogFormFullWidthSx } from "../catalogFormLayout";

type CatalogEntryRotationSectionProps = {
  selectedBin: Rotation | null;
  onSelectBin: (bin: Rotation | null) => void;
  disabled?: boolean;
  helperText?: string | null;
  "data-testid"?: string;
};

export default function CatalogEntryRotationSection({
  selectedBin,
  onSelectBin,
  disabled = false,
  helperText,
  "data-testid": dataTestId = "catalog-form-rotation-section",
}: CatalogEntryRotationSectionProps) {
  return (
    <CatalogFormFieldGroup data-testid={dataTestId}>
      <Box sx={catalogFormFullWidthSx}>
        <CatalogRotationBinPicker
          selectedBin={selectedBin}
          onSelectBin={onSelectBin}
          disabled={disabled}
          showLabel={false}
        />
        {helperText ? (
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            {helperText}
          </Typography>
        ) : null}
      </Box>
    </CatalogFormFieldGroup>
  );
}
