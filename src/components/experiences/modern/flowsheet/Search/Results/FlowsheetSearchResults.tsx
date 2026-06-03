"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Box, Chip, Divider, Sheet, Stack, Typography } from "@mui/joy";
import { useEffect, useMemo, useState } from "react";
import FlowsheetBackendResults from "./BackendResults/FlowsheetBackendResults";
import NewEntryPreview from "./NewEntry/NewEntryPreview";
import LibraryTrackPicker, {
  useLibraryTrackPicker,
} from "../LibraryTrackPicker";

export default function FlowsheetSearchResults({
  binResults,
  catalogResults,
  rotationResults,
  lmlResults,
}: {
  binResults: AlbumEntry[];
  catalogResults: AlbumEntry[];
  rotationResults: AlbumEntry[];
  lmlResults: AlbumEntry[];
}) {
  const dispatch = useAppDispatch();
  const open = useAppSelector(flowsheetSlice.selectors.getSearchOpen);
  const rotationMode = useAppSelector(flowsheetSlice.selectors.getRotationMode);
  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  // Resolve the highlighted result to a release id so the picker knows what to
  // fetch. Index 0 is the "new entry" preview (free-text only — no release to
  // pick tracks from). Indices 1+ map into the concatenated result lists in
  // the same order they're rendered above (bin → rotation → catalog → lml).
  const allResults = useMemo(
    () => [...binResults, ...rotationResults, ...catalogResults, ...lmlResults],
    [binResults, rotationResults, catalogResults, lmlResults]
  );
  const highlightedResult: AlbumEntry | null =
    selectedResult > 0 ? allResults[selectedResult - 1] ?? null : null;

  const [manualOverride, setManualOverride] = useState<number | null>(null);
  // Reset the "Not listed — enter manually" opt-out when the DJ navigates to a
  // different result.
  useEffect(() => {
    if (
      manualOverride !== null &&
      highlightedResult?.id !== manualOverride
    ) {
      setManualOverride(null);
    }
  }, [highlightedResult?.id, manualOverride]);

  // A library-unlinked rotation/catalog row carries a synthesized negative
  // id from synthesizeAlbumId — there's no real release to pick tracks from,
  // and #702's chokepoint drops track_position anyway. Skip the picker entirely
  // for those rows instead of letting the DJ pick something we'll silently
  // discard. (dj-site#704)
  const pickerAlbumId =
    highlightedResult &&
    highlightedResult.id > 0 &&
    highlightedResult.id !== manualOverride
      ? highlightedResult.id
      : null;
  const picker = useLibraryTrackPicker(pickerAlbumId);

  const showPickerRow =
    !!highlightedResult && highlightedResult.id > 0 && !rotationMode;

  return (
    <Sheet
      variant="outlined"
      data-testid="flowsheet-search-results"
      sx={{
        visibility: open && !rotationMode ? "visible" : "hidden",
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
          <Divider
            sx={{
              visibility: lmlResults.length > 0 ? "inherit" : "hidden",
            }}
          />
          <FlowsheetBackendResults
            results={lmlResults}
            offset={binResults.length + rotationResults.length + catalogResults.length + 1}
            label="From Library Search"
          />
        </Box>
        {showPickerRow && (
          <>
            <Divider />
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              data-testid="flowsheet-search-track-picker-row"
              sx={{ flexShrink: 0, minHeight: "40px", p: 1 }}
            >
              <Typography
                level="body-xs"
                sx={{
                  color: "text.tertiary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  minWidth: "fit-content",
                }}
              >
                Track
              </Typography>
              {picker.show ? (
                <LibraryTrackPicker
                  tracks={picker.tracks}
                  isLoading={picker.isLoading}
                  disabled={false}
                  onManualEntry={() => {
                    if (highlightedResult)
                      setManualOverride(highlightedResult.id);
                    dispatch(
                      flowsheetSlice.actions.setSearchProperty({
                        name: "song",
                        value: "",
                      })
                    );
                    // The DJ is opting out of the tracklist — any previously
                    // picked position would otherwise ride through paired with
                    // the highlighted album_id. (dj-site#704)
                    dispatch(flowsheetSlice.actions.setTrackPosition(undefined));
                  }}
                />
              ) : picker.isLoading ? (
                <Typography level="body-xs" sx={{ opacity: 0.5 }}>
                  Loading tracks…
                </Typography>
              ) : (
                <Typography level="body-xs" sx={{ opacity: 0.5 }}>
                  No tracklist on file — type the song title above.
                </Typography>
              )}
            </Stack>
          </>
        )}
        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={0.5}
          sx={{
            flexShrink: 0,
            minHeight: "40px",
            p: 1,
            flexWrap: "wrap",
            gap: 0.5,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip variant="soft" size="sm" color="neutral">
              <Typography level="body-xs">TAB</Typography>
            </Chip>
            <Typography level="body-xs" sx={{ whiteSpace: "nowrap" }}>
              switch fields
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip variant="soft" size="sm" color="neutral">
              <Typography level="body-xs">⇧ TAB</Typography>
            </Chip>
            <Typography level="body-xs" sx={{ whiteSpace: "nowrap" }}>
              prev field
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip variant="soft" size="sm" color="neutral">
              <Typography level="body-xs">↑</Typography>
            </Chip>
            <Typography level="body-xs" sx={{ whiteSpace: "nowrap" }}>
              prev entry
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip variant="soft" size="sm" color="neutral">
              <Typography level="body-xs">↓</Typography>
            </Chip>
            <Typography level="body-xs" sx={{ whiteSpace: "nowrap" }}>
              next entry
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip variant="soft" size="sm" color="neutral">
              <Typography level="body-xs">⏎</Typography>
            </Chip>
            <Typography level="body-xs" sx={{ whiteSpace: "nowrap" }}>
              <Typography color="primary">play</Typography>
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip variant="soft" size="sm" color="neutral">
              <Typography level="body-xs">CTRL ⏎</Typography>
            </Chip>
            <Typography level="body-xs" sx={{ whiteSpace: "nowrap" }}>
              <Typography color="success">queue</Typography>
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Sheet>
  );
}
