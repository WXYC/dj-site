import { cloneElement, useId, type ReactElement } from "react";
import { Box, Tooltip } from "@mui/joy";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { VISUALLY_HIDDEN } from "../visuallyHidden";

/**
 * A short explanation of a button, shown on hover (where the device can hover) and on keyboard focus, never on a touch screen. The same text, after any description the button already has, is always in the page as the button's accessible description, so a screen reader hears it whether or not the tooltip is open; the tooltip is never the button's name. A button the row lock disables fires no hover or focus events, so its tooltip stays silent while it is disabled, but its description still reads.
 */
export default function ActionTooltip({ title, children }: { title: string; children: ReactElement<{ "aria-describedby"?: string }> }) {
  const descriptionId = useId();
  const canHover = useMediaQuery("(hover: hover)");
  return (
    <>
      <Tooltip
        // The title is a node, not a string, so Joy does not copy it into the child's aria-label.
        title={<>{title}</>}
        describeChild
        enterDelay={500}
        disableHoverListener={!canHover}
        disableTouchListener
      >
        {cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], descriptionId].filter(Boolean).join(" ") })}
      </Tooltip>
      <Box component="span" id={descriptionId} sx={VISUALLY_HIDDEN}>{title}</Box>
    </>
  );
}
