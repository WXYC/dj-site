"use client";

import { Card, CardContent, Stack, Typography } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";
import type { ReactNode } from "react";

import {
  formSectionCardInteractiveSx,
  formSectionCardSx,
} from "./formSectionCardStyles";

type FormSectionCardProps = {
  /** The section's heading. Omit it where something around the card already names the section, such as a tab. */
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  disabled?: boolean;
  interactive?: boolean;
  "data-testid"?: string;
};

/** An outlined card framing one section of a form, with an optional heading, header action and footer. */
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
  // Both branches must render this identically: the three adopters that pass no
  // action rely on the no-action branch producing the DOM they had before the
  // action slot existed.
  const heading = title ? <Typography level="title-sm">{title}</Typography> : null;

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
            justifyContent={heading ? "space-between" : "flex-end"}
          >
            {heading}
            {action}
          </Stack>
        ) : (
          heading
        )}
        {description ? (
          <Typography
            level="body-xs"
            sx={{ color: "text.tertiary", mt: 0.25, display: "block" }}
          >
            {description}
          </Typography>
        ) : null}
        <Stack spacing={1.5} sx={{ mt: description ? 1 : heading || action ? 0.75 : 0 }}>
          {children}
        </Stack>
        {footer}
      </CardContent>
    </Card>
  );
}
