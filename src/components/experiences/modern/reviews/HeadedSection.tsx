import { useId, type ReactNode } from "react";
import { Stack, Typography, type StackProps, type TypographyProps } from "@mui/joy";

/** Takes a title off the screen while leaving it to assistive technology. */
const OFF_SCREEN = { border: 0, clip: "rect(0 0 0 0)", height: "1px", m: "-1px", overflow: "hidden", p: 0, position: "absolute", whiteSpace: "nowrap", width: "1px" } as const;

/**
 * A section named by its own heading, so it is a region. `level` is the heading's rank, which the host picks so the section nests under its own headings; `titleLevel` is only how the title looks.
 * A control inside can be named by the same heading: pass the `titleId` it points at.
 * `titleExtra` sits beside the heading in a row, outside it, so the section's name stays the title alone. `hideTitle` keeps the heading as the name but takes it off the screen. The remaining props go to the section's `Stack`.
 */
export default function HeadedSection({ title, level = 3, titleLevel = "title-sm", titleId, titleExtra, hideTitle, children, ...stack }: Omit<StackProps, "title" | "component"> & {
  title: ReactNode;
  level?: 3 | 4;
  titleLevel?: TypographyProps["level"];
  titleId?: string;
  titleExtra?: ReactNode;
  hideTitle?: boolean;
}) {
  const ownId = useId();
  const id = titleId ?? ownId;
  const heading = <Typography id={id} component={`h${level}`} level={titleLevel} sx={hideTitle ? OFF_SCREEN : undefined}>{title}</Typography>;
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
