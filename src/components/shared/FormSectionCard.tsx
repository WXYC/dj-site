"use client";

import { Card, CardContent, Stack, Typography } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";
import type { ReactNode } from "react";

import {
  formSectionCardInteractiveSx,
  formSectionCardSx,
} from "./formSectionCardStyles";

type FormSectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  disabled?: boolean;
  interactive?: boolean;
  "data-testid"?: string;
};

export default function FormSectionCard({
  title,
  description,
  children,
  footer,
  action,
  disabled = false,
  interactive = true,
  "data-testid": dataTestId,
}: FormSectionCardProps) {
  return (
    <Card
      variant="outlined"
      data-testid={dataTestId}
      sx={
        [
          formSectionCardSx,
          interactive ? formSectionCardInteractiveSx : {},
          disabled ? { opacity: 0.55, pointerEvents: "none" } : {},
        ] as SxProps
      }
    >
      <CardContent>
        {action ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography level="title-sm">{title}</Typography>
            {action}
          </Stack>
        ) : (
          <Typography level="title-sm">{title}</Typography>
        )}
        {description ? (
          <Typography
            level="body-xs"
            sx={{ color: "text.tertiary", mt: 0.25, display: "block" }}
          >
            {description}
          </Typography>
        ) : null}
        <Stack spacing={1.5} sx={{ mt: description ? 1 : 0.75 }}>
          {children}
        </Stack>
        {footer}
      </CardContent>
    </Card>
  );
}
