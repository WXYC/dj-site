import { useId, type ReactNode } from "react";
import { Stack, Typography, type StackProps, type TypographyProps } from "@mui/joy";
import { VISUALLY_HIDDEN } from "../visuallyHidden";

/**
 * A section named by its own heading, so it is a region. `headingLevel` is the heading's rank (3 unless the host nests it under an h3 of its own); `titleLevel` is only how the title looks.
 * The heading's id comes from `useId`, so a section rendered twice on one page never shares a name. A control inside can be named by the same heading: pass a `titleId` from the host's own `useId` and point the control at it.
 * `titleExtra` sits beside the heading in a row, outside it, so the section's name stays the title alone. `hideTitle` keeps the heading as the name but takes it off the screen. The remaining props go to the section's `Stack`.
 */
export default function HeadedSection({ title, headingLevel = 3, titleLevel = "title-sm", titleId, titleExtra, hideTitle, children, ...stack }: Omit<StackProps, "title" | "component"> & {
  title: ReactNode;
  headingLevel?: 3 | 4;
  titleLevel?: TypographyProps["level"];
  titleId?: string;
  titleExtra?: ReactNode;
  hideTitle?: boolean;
}) {
  const ownId = useId();
  const id = titleId ?? ownId;
  const heading = <Typography id={id} component={`h${headingLevel}`} level={titleLevel} sx={hideTitle ? VISUALLY_HIDDEN : undefined}>{title}</Typography>;
  return (
    <Stack {...stack} component="section" aria-labelledby={id}>
      {titleExtra === undefined ? heading : (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {heading}
          {titleExtra}
        </Stack>
      )}
      {children}
    </Stack>
  );
}
