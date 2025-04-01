"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppSelector } from "@/lib/hooks";
import { Box, Chip, Divider, Sheet, Stack, Typography } from "@mui/joy";
import FlowsheetBackendResults from "./BackendResults/FlowsheetBackendResults";
import NewEntryPreview from "./NewEntry/NewEntryPreview";

export default function FlowsheetSearchResults({
  binResults,
  catalogResults,
  rotationResults,
}: {
  binResults: AlbumEntry[];
  catalogResults: AlbumEntry[];
  rotationResults: AlbumEntry[];
}) {
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
          maxHeight: "calc(80vh - 60px)",
          transition: "height 0.2s ease-in-out",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            overflowY: "auto",
            flex: 1,
          }}
        >
          <NewEntryPreview />
          <Divider
            sx={{ visibility: binResults.length > 0 ? "inherit" : "hidden" }}
          />
          <FlowsheetBackendResults
            results={binResults}
            offset={1}
            label="From Your Mail Bin"
          />{" "}
          <Divider
            sx={{
              visibility: rotationResults.length > 0 ? "inherit" : "hidden",
            }}
          />
          <FlowsheetBackendResults
            results={rotationResults}
            offset={binResults.length + 1}
            label="From Rotation"
          />{" "}
          <Divider
            sx={{
              visibility: catalogResults.length > 0 ? "inherit" : "hidden",
            }}
          />
          <FlowsheetBackendResults
            results={catalogResults}
            offset={binResults.length + rotationResults.length + 1}
            label="From the Card Catalog"
          />
        </Box>
        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={0.25}
          sx={{
            flexShrink: 0,
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
          <Typography level="body-xs">
            sets the current result{" "}
            <Typography color="primary">playing</Typography>
          </Typography>
          <Chip variant="soft" size="sm" color="neutral">
            <Typography level="body-xs">CTRL + ENTER</Typography>
          </Chip>
          <Typography level="body-xs">
            adds the result to the{" "}
            <Typography color="success">queue</Typography>
          </Typography>
        </Stack>
      </Box>
    </Sheet>
  );
}
