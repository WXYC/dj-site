import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { ColorPaletteProp, VariantProp } from "@mui/joy";
import { useTheme } from '@mui/joy/styles';
import { DragControls, MotionProps, Reorder } from "motion/react";
import RemoveButton from "./Components/RemoveButton";

export default function DraggableEntryWrapper({
  children,
  entryRef,
  controls,
  variant,
  color,
  style,
}: {
  children: React.ReactNode;
  entryRef: FlowsheetEntry;
  controls: DragControls;
  variant?: VariantProp;
  color?: ColorPaletteProp;
  style?: MotionProps["style"];
}) {
  const theme = useTheme();

  const {
    entries: { switchEntries },
  } = useFlowsheet();

  return (
    <Reorder.Item
      value={entryRef}
      as="tr"
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => switchEntries(entryRef)}
      data-testid={`flowsheet-entry-${entryRef.id}`}
      style={{
        ...style,
        // The row color is painted by the cells (via --row-bg) so they can
        // carry rounded corners; a tr background would bleed square.
        ["--row-bg" as string]:
          variant === "solid"
            ? theme.palette[color ?? "neutral"].solidBg
            : variant === "soft"
              ? theme.palette[color ?? "neutral"].softBg
              : theme.palette.background.level1,
        background: "transparent",
      }}
    >
        {children}
    </Reorder.Item>
  );
}
