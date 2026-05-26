"use client";

import {
  Card,
  CardActions,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/joy";
import type { ReactNode } from "react";
import { catalogEntryFormCardSx } from "./catalogFormLayout";

type CatalogEntryFormCardProps = {
  title: string;
  titleDecorator?: ReactNode;
  subtitle?: string;
  headerExtra?: ReactNode;
  navigation?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  "data-testid"?: string;
};

export default function CatalogEntryFormCard({
  title,
  titleDecorator,
  subtitle,
  headerExtra,
  navigation,
  children,
  actions,
  "data-testid": dataTestId = "catalog-entry-form-card",
}: CatalogEntryFormCardProps) {
  return (
    <Card variant="outlined" data-testid={dataTestId} sx={catalogEntryFormCardSx}>
      <Typography level="title-lg" startDecorator={titleDecorator}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography level="body-sm" sx={{ color: "text.tertiary", mt: 0.5 }}>
          {subtitle}
        </Typography>
      ) : null}
      {headerExtra ? <Stack sx={{ mt: 1.5 }}>{headerExtra}</Stack> : null}
      <Divider inset="none" sx={{ my: 1.5 }} />
      {navigation ? (
        <Stack sx={{ mb: 2, width: "100%" }}>{navigation}</Stack>
      ) : null}
      <CardContent sx={{ p: 0, "&:last-child": { pb: actions ? 0 : undefined } }}>
        {children}
      </CardContent>
      {actions ? (
        <CardActions sx={{ justifyContent: "flex-end", gap: 1, pt: 1, flexWrap: "wrap" }}>
          {actions}
        </CardActions>
      ) : null}
    </Card>
  );
}
