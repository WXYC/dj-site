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
  className,
}: {
  children: React.ReactNode;
  entryRef: FlowsheetEntry;
  controls: DragControls;
  variant?: VariantProp;
  color?: ColorPaletteProp;
  style?: MotionProps["style"];
  className?: string;
}) {
  const theme = useTheme();

  const {
    entries: { switchEntries },
  } = useFlowsheet();

  // Visual-level classes let the page styles target playing vs. ordinary
  // rows (hover fill, always-visible actions) without prop drilling.
  const rowClass =
    [
      variant === "solid"
        ? "row-playing"
        : (variant ?? "plain") === "plain"
          ? "row-plain"
          : undefined,
      className,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <Reorder.Item
      value={entryRef}
      as="tr"
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => switchEntries(entryRef)}
      data-testid={`flowsheet-entry-${entryRef.id}`}
      className={rowClass}
      style={{
        ...style,
        // The row color is painted by the cells (via --row-bg) so they can
        // carry rounded corners; a tr background would bleed square.
        // Ordinary play rows sit nearly flush with the page; hover supplies
        // the lift (see page table styles).
        ["--row-bg" as string]:
          variant === "solid"
            ? theme.palette[color ?? "neutral"].solidBg
            : variant === "soft"
              ? theme.palette[color ?? "neutral"].softBg
              : "rgba(255, 255, 255, 0.015)",
        ["--row-accent" as string]:
          theme.palette[color ?? "neutral"].solidBg,
        background: "transparent",
      }}
    >
        {children}
    </Reorder.Item>
  );
}
