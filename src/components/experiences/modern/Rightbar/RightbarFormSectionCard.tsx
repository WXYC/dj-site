"use client";

import { Card, CardContent, Stack, Typography } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";
import type { ReactNode } from "react";

import {
  rightbarFormCardInteractiveSx,
  rightbarFormCardSx,
} from "./rightbarFormCardStyles";

type RightbarFormSectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
  interactive?: boolean;
  "data-testid"?: string;
};

export default function RightbarFormSectionCard({
  title,
  description,
  children,
  footer,
  disabled = false,
  interactive = true,
  "data-testid": dataTestId,
}: RightbarFormSectionCardProps) {
  return (
    <Card
      variant="outlined"
      data-testid={dataTestId}
      sx={
        [
          rightbarFormCardSx,
          interactive ? rightbarFormCardInteractiveSx : {},
          disabled ? { opacity: 0.55, pointerEvents: "none" } : {},
        ] as SxProps
      }
    >
      <CardContent>
        <Typography level="title-sm">{title}</Typography>
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
