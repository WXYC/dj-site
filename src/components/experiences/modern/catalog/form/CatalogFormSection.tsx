"use client";

import { Stack, Typography } from "@mui/joy";
import type { ReactNode } from "react";

type CatalogFormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  "data-testid"?: string;
};

export default function CatalogFormSection({
  title,
  description,
  children,
  "data-testid": dataTestId,
}: CatalogFormSectionProps) {
  return (
    <Stack spacing={1.5} data-testid={dataTestId}>
      <Stack spacing={0.25}>
        <Typography level="title-sm">{title}</Typography>
        {description ? (
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            {description}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Stack>
  );
}
