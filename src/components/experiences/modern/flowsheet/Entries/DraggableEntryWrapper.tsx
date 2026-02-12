import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { ColorPaletteProp, VariantProp } from "@mui/joy";
import { useTheme } from '@mui/joy/styles';
import { DragControls, MotionProps, Reorder } from "motion/react";

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
      style={{
        ...style,
        background:
          (variant ?? "plain") == "plain"
            ? theme.palette?.[color ?? "neutral"]?.[
                `${variant ?? "plain"}Bg` as keyof typeof theme.palette.primary
              ]
            : theme.palette.background.backdrop,
      }}
    >
        {children}
    </Reorder.Item>
  );
}
