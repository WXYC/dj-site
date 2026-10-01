import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { ColorPaletteProp, VariantProp } from "@mui/joy";
import { DragControls, MotionProps, Reorder } from "motion/react";
import { CSSProperties } from "react";
import { useFlowsheetDragContext } from "./dragContext";
import { StaticEntryRow, useEntryRowAttributes } from "./EntryRow";

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
  /** The row an archive link named; see EntryRow's `EntryRowAttributesInput`. */
  highlighted?: boolean;
}) {
  const { onEntryDragStart, onEntryDragEnd } = useFlowsheetDragContext();

  const attributes = useEntryRowAttributes({
    entry,
    variant,
    color,
    className,
    style: style as CSSProperties | undefined,
    highlighted,
  });

  // Non-draggable rows render outside the motion tree: no layout tracking,
  // and no Reorder.Item — a mounted Item missing from the group's `values`
  // wedges motion's reorder detection when a drag crosses it.
  if (!draggable) {
    return <StaticEntryRow {...attributes}>{children}</StaticEntryRow>;
  }

  return (
    <Reorder.Item
      value={entry}
      as="tr"
      dragListener={false}
      dragControls={controls}
      onDragStart={() => onEntryDragStart()}
      onDragEnd={() => onEntryDragEnd(entry)}
      {...attributes}
    >
        {children}
    </Reorder.Item>
  );
}
