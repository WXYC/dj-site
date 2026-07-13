"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import {
  InfoOutlined,
  LinkOff,
  LinkRounded,
  PhoneDisabled,
  PhoneEnabled,
} from "@mui/icons-material";
import { Checkbox, IconButton, Tooltip } from "@mui/joy";
import RemoveButton from "../Components/RemoveButton";

// The interactive controls for a song entry — segue + request toggles, the
// album-detail info button, and remove — shared by the desktop row and the
// mobile card so their mutation logic stays in one place. The parent lays
// them out (desktop: right-edge overlay; mobile: bottom row).
export default function SongEntryControls({
  entry,
  queue,
  editable,
  showRemove = true,
}: {
  entry: FlowsheetSongEntry;
  queue: boolean;
  editable: boolean;
  // Mobile places remove at the end of the bar itself, so it can opt out here.
  showRemove?: boolean;
}) {
  const dispatch = useAppDispatch();
  const { updateFlowsheet } = useFlowsheet();

  const commit = (field: "segue" | "request_flag", value: boolean) => {
    if (queue) {
      dispatch(
        flowsheetSlice.actions.updateQueueEntry({
          entry_id: entry.id,
          field,
          value,
        })
      );
    } else {
      updateFlowsheet({ entry_id: entry.id, data: { [field]: value } });
    }
  };

  return (
    <>
      {editable && (
        <>
          <Tooltip
            variant="outlined"
            size="sm"
            title="Does this track segue from the previous?"
          >
            <Checkbox
              size="sm"
              variant="soft"
              color={entry.segue ? "primary" : "neutral"}
              className={entry.segue ? "row-actions-persist" : undefined}
              uncheckedIcon={<LinkOff />}
              checkedIcon={<LinkRounded />}
              slotProps={{ input: { "aria-label": "Segue from previous track" } }}
              sx={{
                opacity: entry.segue ? 1 : 0.3,
                // Match the icon buttons' footprint (32px) and glyph size so
                // the toggles don't read as smaller/compressed next to them.
                "--Checkbox-size": "1.25rem",
                p: "6px",
                "& .MuiCheckbox-checkbox": { background: "transparent" },
              }}
              checked={entry.segue}
              onChange={(e) => commit("segue", e.target.checked)}
            />
          </Tooltip>
          <Tooltip variant="outlined" size="sm" title="Was this song a request?">
            <Checkbox
              size="sm"
              variant="soft"
              color={entry.request_flag ? "warning" : "neutral"}
              className={entry.request_flag ? "row-actions-persist" : undefined}
              uncheckedIcon={<PhoneDisabled />}
              checkedIcon={<PhoneEnabled />}
              slotProps={{ input: { "aria-label": "Requested track" } }}
              sx={{
                opacity: entry.request_flag ? 1 : 0.3,
                "--Checkbox-size": "1.25rem",
                p: "6px",
                "& .MuiCheckbox-checkbox": { background: "transparent" },
              }}
              checked={entry.request_flag}
              onChange={(e) => commit("request_flag", e.target.checked)}
            />
          </Tooltip>
        </>
      )}
      <IconButton
        color="neutral"
        variant="plain"
        size="sm"
        disabled={!entry?.album_id || entry.album_id < 0}
        aria-label="Album information"
        onClick={() =>
          dispatch(
            applicationSlice.actions.openPanel({
              type: "album-detail",
              albumId: entry.album_id!,
            })
          )
        }
      >
        <InfoOutlined />
      </IconButton>
      {editable && showRemove && <RemoveButton queue={queue} entry={entry} />}
    </>
  );
}
