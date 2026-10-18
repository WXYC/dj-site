import { cloneElement, useId, type ReactElement } from "react";
import { Tooltip, type TooltipProps } from "@mui/joy";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";

type Child = ReactElement<{ "aria-describedby"?: string; disabled?: boolean; loading?: boolean }>;

/**
 * A short explanation of a button, shown on hover (where the device can hover) and on keyboard focus, never on a touch screen. The same text, after any description the button already has, is always in the page as the button's accessible description, so a screen reader hears it whether or not the tooltip is open; the tooltip is never the button's name. The description is a `hidden` element, which `aria-describedby` still resolves, so it is not also read again in the page's reading order.
 *
 * While the button is disabled or loading the tooltip is closed and stays closed: a disabled control may fire no mouseleave or blur to close it, so the title is dropped during render, which Joy treats as nothing to show. The description still reads.
 *
 * `placement` is where the tooltip sits against the button; use "top" for a button that opens a menu below it.
 */
export default function ActionTooltip({ title, placement, children }: { title: string; placement?: TooltipProps["placement"]; children: Child }) {
  const descriptionId = useId();
  const canHover = useMediaQuery("(hover: hover)");
  const inert = Boolean(children.props.disabled || children.props.loading);
  return (
    <>
      <Tooltip
        // The title is a node, not a string: with `describeChild`, Joy copies a string title into the child's native `title`, and the browser would then draw its own tooltip beside this one.
        title={inert ? null : <>{title}</>}
        placement={placement}
        describeChild
        enterDelay={500}
        disableHoverListener={!canHover}
        disableTouchListener
      >
        {cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], descriptionId].filter(Boolean).join(" ") })}
      </Tooltip>
      <span hidden id={descriptionId}>{title}</span>
    </>
  );
}
