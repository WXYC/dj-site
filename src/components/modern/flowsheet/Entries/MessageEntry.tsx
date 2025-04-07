"use client";

import {
  AspectRatio,
  Box,
  ColorPaletteProp,
  Sheet,
  Stack,
  Typography,
  VariantProp,
} from "@mui/joy";
import RemoveButton from "./Components/RemoveButton";
import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useState } from "react";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import DragButton from "./Components/DragButton";

export default function MessageEntry({
  startDecorator,
  children,
  endDecorator,
  color,
  variant,
  entryRef,
  disableEditing = false,
}: {
  startDecorator?: React.ReactNode;
  children: React.ReactNode;
  endDecorator?: React.ReactNode;
  color: ColorPaletteProp;
  variant: VariantProp;
  entryRef: FlowsheetEntry;
  disableEditing?: boolean;
}) {
  const { live, currentShow } = useShowControl();
  const [canClose, setCanClose] = useState(false);

  const editable = (entryRef.show_id == currentShow) && !disableEditing;

  return (
    <Sheet
      component="tr"
      variant={variant}
      color={color}
      style={{
        height: "40px",
        borderRadius: "md",
      }}
      onMouseOver={() => setCanClose(live && editable)}
      onMouseLeave={() => setCanClose(false)}
    >
      <td>
        <AspectRatio
          ratio={1.5}
          variant="plain"
          sx={{
            flexBasis: "calc(60px - 12px)",
            borderRadius: "9px",
            minWidth: "48px",
            minHeight: "20px",
          }}
        >
          <Typography>{startDecorator}</Typography>
        </AspectRatio>
      </td>
      <Box
        component={"td"}
        style={{
          height: "30px",
          borderRadius: "md",
        }}
        colSpan={6}
      >
        {children}
      </Box>
      <td>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="end" sx = {{
          pr: live ? 1 : 0,
        }}>
          <Typography level="body-xs">{endDecorator}</Typography>
          {live && editable && (<DragButton entry={entryRef} queue={false} />)}
        </Stack>
        <RemoveButton canClose={canClose} queue={false} playing={false} entry={entryRef} />
      </td>
    </Sheet>
  );
}
