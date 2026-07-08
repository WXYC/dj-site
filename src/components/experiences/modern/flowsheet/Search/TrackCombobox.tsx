"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";
import { useGetLibraryTracksQuery } from "@/lib/features/metadata/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useMemo } from "react";

type TrackOption = { title: string; position?: string };

export default function TrackCombobox({
  albumId,
  disabled,
  inputRef,
  onFlush,
}: {
  albumId: number;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onFlush?: () => void;
}) {
  const dispatch = useAppDispatch();
  const song = useAppSelector(
    (s) => flowsheetSlice.selectors.getSearchQuery(s).song
  );
  const trackPosition = useAppSelector(
    (s) => flowsheetSlice.selectors.getSearchQuery(s).track_position
  );
  const staged = useAppSelector(flowsheetSlice.selectors.getStagedRelease);

  const { data, isFetching } = useGetLibraryTracksQuery(albumId, {
    skip: albumId <= 0,
    refetchOnMountOrArgChange: true,
  });

  const tracks = useMemo<TrackOption[]>(
    () =>
      (data?.tracks ?? []).map((t) => ({
        title: t.title,
        position: t.position,
      })),
    [data?.tracks]
  );

  const selected = useMemo(() => {
    if (trackPosition) {
      return tracks.find((t) => t.position === trackPosition) ?? null;
    }
    if (song) return { title: song, position: undefined };
    return null;
  }, [tracks, trackPosition, song]);

  return (
    <Autocomplete
      freeSolo
      disabled={disabled}
      placeholder="Track title"
      options={tracks}
      loading={isFetching}
      value={selected}
      inputValue={song}
      getOptionLabel={(o) => (typeof o === "string" ? o : o.title)}
      isOptionEqualToValue={(a, b) =>
        typeof a !== "string" &&
        typeof b !== "string" &&
        a.position === b.position &&
        a.title === b.title
      }
      slotProps={{
        input: {
          ref: inputRef,
          "data-testid": "flowsheet-search-song",
          "aria-label": staged ? `Track on ${staged.album}` : "Song",
        },
      }}
      onInputChange={(_, value) => {
        dispatch(
          flowsheetSlice.actions.setSearchProperty({ name: "song", value })
        );
        dispatch(flowsheetSlice.actions.setTrackPosition(undefined));
        onFlush?.();
      }}
      onChange={(_, value) => {
        if (!value || typeof value === "string") {
          dispatch(
            flowsheetSlice.actions.setSearchProperty({
              name: "song",
              value: typeof value === "string" ? value : "",
            })
          );
          dispatch(flowsheetSlice.actions.setTrackPosition(undefined));
          return;
        }
        dispatch(
          flowsheetSlice.actions.setSearchProperty({
            name: "song",
            value: value.title,
          })
        );
        if (value.position) {
          dispatch(flowsheetSlice.actions.setTrackPosition(value.position));
        }
      }}
      renderOption={(props, option) => (
        <AutocompleteOption {...props} key={option.position ?? option.title}>
          {option.title}
          {option.position ? ` (${option.position})` : ""}
        </AutocompleteOption>
      )}
      sx={{ flex: 1, minWidth: 0, "--Input-minHeight": "1.5rem" }}
    />
  );
}
