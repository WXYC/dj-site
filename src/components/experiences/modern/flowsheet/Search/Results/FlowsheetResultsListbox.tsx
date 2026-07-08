"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { HelpOutline } from "@mui/icons-material";
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Popover,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { ClickAwayListener, Popper } from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import {
  useFlowsheetAllResults,
  useFlowsheetResults,
  useFlowsheetResultsLoading,
} from "../FlowsheetSearchProvider";
import {
  flowsheetListboxFooterSx,
  flowsheetListboxScrollSx,
  flowsheetListboxSx,
} from "../flowsheetSearchBarStyles";
import FlowsheetBackendResults from "./BackendResults/FlowsheetBackendResults";
import { capResultGroups } from "./capResultGroups";
import NewEntryRow from "./NewEntryRow";
import RotationBrowse from "../RotationBrowse";

const sameWidth = {
  name: "sameWidth",
  enabled: true,
  phase: "beforeWrite" as const,
  requires: ["computeStyles"],
  fn: ({ state }: { state: { styles: { popper: { width: string } }; rects: { reference: { width: number } } } }) => {
    state.styles.popper.width = `${state.rects.reference.width}px`;
  },
  effect: ({ state }: { state: { elements: { popper: HTMLElement; reference: HTMLElement } } }) => {
    state.elements.popper.style.width = `${state.elements.reference.offsetWidth}px`;
  },
};

export default function FlowsheetResultsListbox({
  anchorEl,
  onStageRelease,
}: {
  anchorEl: HTMLElement | null;
  onStageRelease: (entry: AlbumEntry) => void;
}) {
  const dispatch = useAppDispatch();
  const open = useAppSelector(flowsheetSlice.selectors.getSearchOpen);
  const scope = useAppSelector(flowsheetSlice.selectors.getSearchScope);
  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  const { binResults, rotationResults, catalogResults, lmlResults } =
    useFlowsheetResults();
  const loading = useFlowsheetResultsLoading();
  const allResults = useFlowsheetAllResults();

  const [legendOpen, setLegendOpen] = useState(false);
  const narrow = typeof window !== "undefined" && window.innerWidth < 600;
  const capTotal = narrow ? 6 : 10;
  const capBase = narrow ? 2 : 3;

  const [cappedBin, cappedRotation, cappedCatalog, cappedLml] = useMemo(
    () =>
      capResultGroups(
        [binResults, rotationResults, catalogResults, lmlResults],
        capTotal,
        capBase
      ),
    [binResults, rotationResults, catalogResults, lmlResults, capTotal, capBase]
  );

  const staleOpacity = (fetching: boolean) => (fetching ? 0.65 : 1);

  const handleClickAway = useCallback(() => {
    dispatch(flowsheetSlice.actions.setSearchOpen(false));
  }, [dispatch]);

  const rotationOnly = scope === "rotation";
  const showListbox = open && anchorEl;

  return (
    <Popper
      open={Boolean(showListbox)}
      anchorEl={anchorEl}
      placement="bottom-start"
      modifiers={[sameWidth, { name: "offset", options: { offset: [0, 4] } }]}
      sx={{ zIndex: "var(--joy-zIndex-popup)" }}
    >
      <ClickAwayListener onClickAway={handleClickAway}>
        <Sheet
          variant="outlined"
          data-testid="flowsheet-search-results"
          role="listbox"
          id="flowsheet-results-listbox"
          sx={flowsheetListboxSx}
        >
          <Box sx={flowsheetListboxScrollSx}>
            {rotationOnly ? (
              <RotationBrowse disabled={false} />
            ) : (
              <>
                <NewEntryRow />
                <Divider sx={{ visibility: cappedBin.length ? "visible" : "hidden" }} />
                <Box sx={{ opacity: staleOpacity(loading.binFetching), transition: "opacity 120ms" }}>
                  <FlowsheetBackendResults
                    results={cappedBin}
                    offset={1}
                    label="Your Bin"
                    onStage={onStageRelease}
                  />
                </Box>
                <Divider sx={{ visibility: cappedRotation.length ? "visible" : "hidden" }} />
                <Box sx={{ opacity: staleOpacity(loading.rotationFetching), transition: "opacity 120ms" }}>
                  <FlowsheetBackendResults
                    results={cappedRotation}
                    offset={cappedBin.length + 1}
                    label="Rotation"
                    onStage={onStageRelease}
                  />
                </Box>
                <Divider sx={{ visibility: cappedCatalog.length ? "visible" : "hidden" }} />
                <Box sx={{ opacity: staleOpacity(loading.catalogFetching), transition: "opacity 120ms" }}>
                  <FlowsheetBackendResults
                    results={cappedCatalog}
                    offset={cappedBin.length + cappedRotation.length + 1}
                    label="Card Catalog"
                    onStage={onStageRelease}
                  />
                </Box>
                <Divider sx={{ visibility: cappedLml.length ? "visible" : "hidden" }} />
                <Box sx={{ opacity: staleOpacity(loading.lmlFetching), transition: "opacity 120ms" }}>
                  <FlowsheetBackendResults
                    results={cappedLml}
                    offset={
                      cappedBin.length +
                      cappedRotation.length +
                      cappedCatalog.length +
                      1
                    }
                    label="Library"
                    onStage={onStageRelease}
                  />
                </Box>
              </>
            )}
          </Box>
          <Stack direction="row" sx={flowsheetListboxFooterSx}>
            <IconButton
              size="sm"
              variant="plain"
              aria-label="Keyboard shortcuts"
              data-testid="flowsheet-shortcut-legend"
              onClick={() => setLegendOpen((v) => !v)}
            >
              <HelpOutline fontSize="small" />
            </IconButton>
            <Popover open={legendOpen} onClose={() => setLegendOpen(false)} placement="top-end">
              <Sheet variant="outlined" sx={{ p: 1.5, maxWidth: 320 }}>
                <Stack spacing={0.5}>
                  <ShortcutRow keys="Tab" desc="next field" />
                  <ShortcutRow keys="⇧Tab" desc="previous field" />
                  <ShortcutRow keys="→" desc="accept suggestion" />
                  <ShortcutRow keys="↓ ↑" desc="navigate results" />
                  <ShortcutRow keys="⏎" desc="stage / submit" />
                  <ShortcutRow keys="⌃⏎" desc="queue" />
                  <ShortcutRow keys="Esc" desc="close / unstage / clear" />
                </Stack>
              </Sheet>
            </Popover>
          </Stack>
        </Sheet>
      </ClickAwayListener>
    </Popper>
  );
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Chip size="sm" variant="soft">
        <Typography level="body-xs">{keys}</Typography>
      </Chip>
      <Typography level="body-xs">{desc}</Typography>
    </Stack>
  );
}
