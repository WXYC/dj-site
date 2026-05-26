"use client";

import AdminCatalogCodePreview, {
  type AdminCatalogCodePreviewProps,
} from "@/src/components/experiences/modern/admin/catalog/AdminCatalogCodePreview";
import { Stack, Typography } from "@mui/joy";

type CatalogFormCodeStripProps = AdminCatalogCodePreviewProps & {
  summary?: string | null;
  "data-testid"?: string;
};

export default function CatalogFormCodeStrip({
  summary,
  "data-testid": dataTestId = "catalog-form-code-strip",
  ...previewProps
}: CatalogFormCodeStripProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      data-testid={dataTestId}
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: "sm",
        bgcolor: "background.level1",
      }}
    >
      <AdminCatalogCodePreview size="sm" {...previewProps} />
      {summary ? (
        <Typography
          level="body-sm"
          sx={{
            color: "text.secondary",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </Typography>
      ) : null}
    </Stack>
  );
}
