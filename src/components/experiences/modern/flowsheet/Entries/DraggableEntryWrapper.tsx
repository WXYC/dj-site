import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { ColorPaletteProp, VariantProp } from "@mui/joy";
import { useTheme } from '@mui/joy/styles';
import { DragControls, MotionProps, Reorder } from "motion/react";
import RemoveButton from "./Components/RemoveButton";

const ROW_CLASS_BY_VARIANT: Partial<Record<VariantProp, string>> = {
  solid: "row-playing",
  plain: "row-plain",
};

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
    [ROW_CLASS_BY_VARIANT[variant ?? "plain"], className]
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
        ["--row-bg" as string]: rowBg,
        ["--row-accent" as string]:
          theme.palette[color ?? "neutral"].solidBg,
        background: "transparent",
      }}
    >
        {children}
    </Reorder.Item>
  );
}
