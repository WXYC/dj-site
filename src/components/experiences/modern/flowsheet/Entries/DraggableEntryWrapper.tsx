import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { ColorPaletteProp, VariantProp } from "@mui/joy";
import { useTheme } from '@mui/joy/styles';
import { DragControls, MotionProps, Reorder } from "motion/react";
import { CSSProperties } from "react";
import { entryAnchorId } from "@/lib/features/schedule-week/showUrl";
import { useFlowsheetDragContext } from "./dragContext";

const ROW_CLASS_BY_VARIANT: Partial<Record<VariantProp, string>> = {
  solid: "row-playing",
  plain: "row-plain",
};

export default function DraggableEntryWrapper({
  children,
  entry,
  controls,
  variant,
  color,
  style,
  className,
  draggable = true,
  highlighted = false,
}: {
  children: React.ReactNode;
  entry: FlowsheetEntry;
  controls: DragControls;
  variant?: VariantProp;
  color?: ColorPaletteProp;
  style?: MotionProps["style"];
  className?: string;
  draggable?: boolean;
  /**
   * The row an archive link named. Carries the anchor the link's fragment
   * points at, which is why the id is set here and only here: an id on every
   * row would collide the moment two tables of entries share a document.
   */
  highlighted?: boolean;
}) {
  const theme = useTheme();

  const { onEntryDragStart, onEntryDragEnd } = useFlowsheetDragContext();

  // Visual-level classes let the page styles target playing vs. ordinary
  // rows (hover fill, always-visible actions) without prop drilling.
  const rowClass =
    [
      ROW_CLASS_BY_VARIANT[variant ?? "plain"],
      className,
      highlighted ? "row-highlighted" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const effectiveVariant = variant ?? "plain";
  // The row color painted by the cells. Plain rows sit nearly flush with the
  // page (hover supplies the lift); anything else falls back to the theme
  // backdrop so an unmapped variant is still visibly distinct.
  const rowBg =
    effectiveVariant === "solid"
      ? theme.palette[color ?? "neutral"].solidBg
      : effectiveVariant === "soft"
        ? theme.palette[color ?? "neutral"].softBg
        : effectiveVariant === "plain"
          ? "rgba(255, 255, 255, 0.015)"
          : theme.palette.background.backdrop;

  const rowStyle = {
    ...style,
    // The row color is painted by the cells (via --row-bg) so they can
    // carry rounded corners; a tr background would bleed square.
    ["--row-bg" as string]: rowBg,
    ["--row-accent" as string]:
      theme.palette[color ?? "neutral"].solidBg,
    background: "transparent",
  };

  const anchorId = highlighted ? entryAnchorId(entry.id) : undefined;

  // Non-draggable rows render outside the motion tree: no layout tracking,
  // and no Reorder.Item — a mounted Item missing from the group's `values`
  // wedges motion's reorder detection when a drag crosses it.
  if (!draggable) {
    return (
      <tr
        id={anchorId}
        data-testid={`flowsheet-entry-${entry.id}`}
        className={rowClass}
        style={rowStyle as CSSProperties}
      >
        {children}
      </tr>
    );
  }

  return (
    <Reorder.Item
      value={entry}
      as="tr"
      dragListener={false}
      dragControls={controls}
      onDragStart={() => onEntryDragStart()}
      onDragEnd={() => onEntryDragEnd(entry)}
      id={anchorId}
      data-testid={`flowsheet-entry-${entry.id}`}
      className={rowClass}
      style={rowStyle}
    >
        {children}
    </Reorder.Item>
  );
}
