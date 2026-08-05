"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Chip, FormControl, FormLabel, Stack } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import {
  useAddRotationEntryMutation,
  useGetRotationQuery,
  useKillRotationEntryMutation,
} from "@/lib/features/rotation/api";
import { Rotation } from "@/lib/features/rotation/types";
import { AlbumEntry } from "@/lib/features/catalog/types";
import RotationBinSelector from "@/src/components/experiences/modern/flowsheet/Search/RotationBinSelector";

interface RotationClassifyControlProps {
  album: AlbumEntry;
}

/**
 * MD+ control for rotation classification: adds an album to a rotation bin
 * via `useAddRotationEntryMutation`, or retires the active entry via
 * `useKillRotationEntryMutation`. Add and kill are two states of one control.
 *
 * The fields live in a child so their hooks — including the rotation-list
 * query the add/kill state is derived from — run only for an authorized
 * viewer. Everyone else renders nothing and issues no request.
 */
function RotationClassifyControl({ album }: RotationClassifyControlProps) {
  return (
    <RequireMD>
      <RotationClassifyFields album={album} />
    </RequireMD>
  );
}

/**
 * Mount with `key={album.id}` from the caller so an in-progress bin pick
 * doesn't leak into the next album.
 */
function RotationClassifyFields({ album }: RotationClassifyControlProps) {
  const [addRotationEntry, { isLoading: addPending }] =
    useAddRotationEntryMutation();
  const [killRotationEntry, { isLoading: killPending }] =
    useKillRotationEntryMutation();

  // The album-detail read (`GET /library/info`) joins no rotation table and
  // selects no rotation columns, so `album.rotation_id` is always undefined
  // here — whether the album is in rotation is only answerable from the
  // active-rotation list. Subscribing with no options joins the cache entry
  // the flowsheet rotation picker already holds instead of forcing a refetch
  // underneath it.
  const { data: rotationEntries, isFetching: rotationFetching } =
    useGetRotationQuery();

  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);

  // Both reads project `library.id` as the row id, so matching on it is
  // matching library album to library album. Rotation rows that never linked
  // to a library album carry a synthesized negative id instead, which no real
  // album id can equal.
  const activeEntry = useMemo(() => {
    if (album.id <= 0) return undefined;
    return rotationEntries?.find(
      (entry) => entry.id === album.id && typeof entry.rotation_id === "number",
    );
  }, [rotationEntries, album.id]);

  const rotationId = activeEntry?.rotation_id ?? null;

  // Both mutations invalidate the rotation list and this control's state only
  // flips once that refetch lands, so the actions stay busy while it is in
  // flight — including the first load, when membership isn't known yet. That
  // window is exactly where a second submit would open a duplicate active
  // entry for the same album, which the backend's bare insert would accept.
  const addBusy = addPending || rotationFetching;
  const killBusy = killPending || rotationFetching;

  const handleAdd = async () => {
    if (!selectedBin) return;
    try {
      await addRotationEntry({
        album_id: album.id,
        rotation_bin: selectedBin,
      }).unwrap();
    } catch {
      toast.error("Failed to add to rotation");
    }
  };

  const handleKill = async () => {
    if (rotationId === null) return;
    try {
      // `kill_date` is omitted so the server dates the kill itself. Computing
      // it here would yield the browser's UTC calendar day, which is already
      // tomorrow during Eastern evening hours; the rotation read keeps entries
      // whose kill_date is in the future, so a tomorrow-dated kill would leave
      // the retired album selectable in the flowsheet picker for another day.
      await killRotationEntry({ rotation_id: rotationId }).unwrap();
      setSelectedBin(null);
    } catch {
      toast.error("Failed to kill rotation entry");
    }
  };

  return rotationId !== null ? (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <Chip size="sm" variant="soft">
        In Rotation
      </Chip>
      <Button
        size="sm"
        color="warning"
        variant="soft"
        loading={killBusy}
        onClick={handleKill}
      >
        Kill
      </Button>
    </Stack>
  ) : (
    <FormControl
      orientation="horizontal"
      sx={{ justifyContent: "space-between", alignItems: "center" }}
    >
      <FormLabel>Rotation</FormLabel>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <RotationBinSelector
          selectedBin={selectedBin}
          onSelectBin={setSelectedBin}
          disabled={addBusy}
        />
        <Button
          size="sm"
          disabled={!selectedBin}
          loading={addBusy}
          onClick={handleAdd}
        >
          Add to Rotation
        </Button>
      </Stack>
    </FormControl>
  );
}

export default RotationClassifyControl;
