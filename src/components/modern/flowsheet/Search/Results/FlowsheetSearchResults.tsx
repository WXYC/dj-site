"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppSelector } from "@/lib/hooks";
import { Box, Chip, Divider, Sheet, Stack, Typography } from "@mui/joy";
import NewEntryPreview from "./NewEntryPreview";

export default function FlowsheetSearchResults() {
  const open = useAppSelector(flowsheetSlice.selectors.getSearchOpen);

  return (
    <Sheet
      variant="outlined"
      sx={{
        visibility: open ? "visible" : "hidden",
        minHeight: "60px",
        position: "absolute",
        top: -5,
        left: -5,
        right: -5,
        zIndex: 8000,
        borderRadius: "md",
        transition: "height 0.2s ease-in-out",
        boxShadow: "0px 34px 24px -9px rgba(0,0,0,0.5)",
      }}
    >
      <Box
        sx={{
          mt: "40px",
          position: "relative",
          minHeight: "40px",
          pb: "40px",
          transition: "height 0.2s ease-in-out",
        }}
      >
        <NewEntryPreview submitResult={() => {}} />
        <Divider />
        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={0.25}
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40px",
            p: 1,
            "& > *": {
              lineHeight: "0.5rem !important",
            },
          }}
        >
          <Chip variant="soft" size="sm" color="neutral">
            <Typography level="body-xs">TAB</Typography>
          </Chip>
          <Typography level="body-xs">switches search fields</Typography>
          <Chip variant="soft" size="sm" color="neutral">
            <Typography level="body-xs">SHIFT + TAB</Typography>
          </Chip>
          <Typography level="body-xs">goes back a field</Typography>
          <Chip variant="soft" size="sm" color="neutral">
            <Typography level="body-xs">UP ARROW</Typography>
          </Chip>
          <Typography level="body-xs">selects the previous entry</Typography>
          <Chip variant="soft" size="sm" color="neutral">
            <Typography level="body-xs">DOWN ARROW</Typography>
          </Chip>
          <Typography level="body-xs">selects the next entry</Typography>
          <Chip variant="soft" size="sm" color="neutral">
            <Typography level="body-xs">ENTER</Typography>
          </Chip>
          <Typography level="body-xs">adds the result to the queue</Typography>
          <Chip variant="soft" size="sm" color="neutral">
            <Typography level="body-xs">SHIFT + ENTER</Typography>
          </Chip>
          <Typography level="body-xs">
            sets the current result <Typography color="primary">playing</Typography>
          </Typography>
        </Stack>
      </Box>
    </Sheet>
  );
}
