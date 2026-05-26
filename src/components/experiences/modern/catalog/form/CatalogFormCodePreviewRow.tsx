"use client";

import AdminCatalogCodePreview, {
  type AdminCatalogCodePreviewProps,
} from "@/src/components/experiences/modern/admin/catalog/AdminCatalogCodePreview";
import { Stack, Typography } from "@mui/joy";

type CatalogFormCodePreviewRowProps = AdminCatalogCodePreviewProps & {
  summary?: string | null;
  "data-testid"?: string;
};

export default function CatalogFormCodePreviewRow({
  summary,
  "data-testid": dataTestId = "catalog-form-code-strip",
  ...previewProps
}: CatalogFormCodePreviewRowProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      data-testid={dataTestId}
      sx={{ py: 0.5 }}
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
