"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { hasLinkedAlbumId } from "@/lib/features/flowsheet/linkage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Box, Chip, Divider, Stack, Typography } from "@mui/joy";
import { useEffect, useMemo, useState } from "react";
import FlowsheetBackendResults, {
  MAX_VISIBLE_RESULTS,
} from "./BackendResults/FlowsheetBackendResults";
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
  const rotationMode = useAppSelector(flowsheetSlice.selectors.getRotationMode);
  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  // Each section paints at most MAX_VISIBLE_RESULTS rows, so the selectedResult
  // index space must be built from the CAPPED lengths — offsets, the nav bound
  // in FlowsheetSearchbar, and the submission mapping in flowsheetHooks all use
  // the same Math.min. Deriving any of them from the full lengths would let the
  // highlight walk off the visible list and submit an unseen album. (#657)
  const binCount = Math.min(binResults.length, MAX_VISIBLE_RESULTS);
  const rotationCount = Math.min(rotationResults.length, MAX_VISIBLE_RESULTS);
  const catalogCount = Math.min(catalogResults.length, MAX_VISIBLE_RESULTS);

  // Resolve the highlighted result to a release id so the picker knows what to
  // fetch. Index 0 is the "new entry" preview (free-text only — no release to
  // pick tracks from). Indices 1+ map into the concatenated VISIBLE (capped)
  // result lists in the same order they're rendered above
  // (bin → rotation → catalog → lml).
  const allResults = useMemo(
    () => [
      ...binResults.slice(0, MAX_VISIBLE_RESULTS),
      ...rotationResults.slice(0, MAX_VISIBLE_RESULTS),
      ...catalogResults.slice(0, MAX_VISIBLE_RESULTS),
      ...lmlResults.slice(0, MAX_VISIBLE_RESULTS),
    ],
    [binResults, rotationResults, catalogResults, lmlResults]
  );
  const highlightedResult: AlbumEntry | null =
    selectedResult > 0 ? allResults[selectedResult - 1] ?? null : null;

  // A click-to-autofill zeroes the highlight; the frozen query keeps the album
  const frozenAlbumId = useAppSelector(
    flowsheetSlice.selectors.getSearchQuery
  ).album_id;

  // A library-unlinked rotation/catalog row carries a synthesized negative
  // id from synthesizeAlbumId — there's no real release to pick tracks from,
  // and #702's chokepoint drops track_position anyway. Skip the picker entirely
  // for those rows instead of letting the DJ pick something we'll silently
  // discard. (dj-site#704)
  const effectiveAlbumId =
    highlightedResult && highlightedResult.id > 0
      ? highlightedResult.id
      : hasLinkedAlbumId(frozenAlbumId)
        ? (frozenAlbumId as number)
        : null;

  const [manualOverride, setManualOverride] = useState<number | null>(null);
  useEffect(() => {
    if (manualOverride !== null && effectiveAlbumId !== manualOverride) {
      setManualOverride(null);
    }
  }, [effectiveAlbumId, manualOverride]);

  const pickerAlbumId =
    effectiveAlbumId !== null && effectiveAlbumId !== manualOverride
      ? effectiveAlbumId
      : null;
  const picker = useLibraryTrackPicker(pickerAlbumId);

  const showPickerRow = effectiveAlbumId !== null && !rotationMode;

  // Panel CONTENT only — the Sheet/Popper/transitions live in FlowsheetSearchbar
  return (
    <Box
      data-testid="flowsheet-search-results"
      sx={{
        minHeight: "40px",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
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
            offset={binCount + 1}
            label="From Rotation"
          />{" "}
          <Divider
            sx={{
              visibility: catalogResults.length > 0 ? "inherit" : "hidden",
            }}
          />
          <FlowsheetBackendResults
            results={catalogResults}
            offset={binCount + rotationCount + 1}
            label="From the Card Catalog"
          />
          <Divider
            sx={{
              visibility: lmlResults.length > 0 ? "inherit" : "hidden",
            }}
          />
          <FlowsheetBackendResults
            results={lmlResults}
            offset={binCount + rotationCount + catalogCount + 1}
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
                    if (effectiveAlbumId !== null)
                      setManualOverride(effectiveAlbumId);
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
              <Typography level="body-xs">→</Typography>
            </Chip>
            <Typography level="body-xs" sx={{ whiteSpace: "nowrap" }}>
              accept + next field
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
  );
}
