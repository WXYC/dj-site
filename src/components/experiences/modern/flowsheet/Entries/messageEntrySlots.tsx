import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { ColorPaletteProp, Stack, Typography } from "@mui/joy";
import { ReactNode } from "react";
import DateTimeStack from "./Components/DateTimeStack";
import { getMessageEntryPresentation } from "./entryPresentation";

/**
 * The three things a message row fills from getMessageEntryPresentation:
 * the icon start decorator, the DateTimeStack end decorator, and the
 * headline/caption block. No motion, no live-show hooks, so a
 * server-rendered read-only row can call this directly; the live row hands
 * each slot to MessageEntry as a prop rather than computing them itself.
 */
export type MessageEntrySlots = {
  startDecorator: ReactNode;
  endDecorator: ReactNode;
  messageBlock: ReactNode;
  color: ColorPaletteProp;
  editable: boolean;
};

export function getMessageEntrySlots(entry: FlowsheetEntry): MessageEntrySlots {
  const p = getMessageEntryPresentation(entry);

  return {
    startDecorator: <p.Icon sx={{ mb: -0.5, mr: 0.5 }} />,
    endDecorator: p.time && (
      <DateTimeStack day={p.time.day} time={p.time.time} isToday={p.time.isToday} />
    ),
    messageBlock: (
      <Stack direction="row" spacing={0.5}>
        <Typography level="body-lg" color={p.textColor}>
          {p.headline}
        </Typography>
        {p.caption && (
          <Typography textColor={"text.tertiary"} sx={{ alignSelf: "center" }}>
            {p.caption}
          </Typography>
        )}
      </Stack>
    ),
    color: p.color,
    editable: p.editable,
  };
}
