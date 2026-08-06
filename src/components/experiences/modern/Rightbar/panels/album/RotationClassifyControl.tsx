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
 * via `useAddRotationEntryMutation`, or retires an active entry via
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
  // active-rotation list.
  const {
    data: rotationEntries,
    isFetching: rotationFetching,
    isError: rotationErrored,
    refetch: refetchRotation,
  } = useGetRotationQuery();

  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);
  const [killTargetId, setKillTargetId] = useState<number | null>(null);

  // `synthesizeAlbumId` hands out negative ids to rows the library never
  // linked (see conversions.ts); neither read nor write may treat one of
  // those as a real album, so both derive from this single flag.
  const albumIdValid = album.id > 0;

  // Both reads project `library.id` as the row id, so matching on it is
  // matching library album to library album. `getRotationFromDB` dedupes
  // with `rotation_bin` as PART of the uniqueness key, so a re-binned album
  // with an unkilled prior entry surfaces as more than one row here — every
  // one of them is a genuinely active entry for this album, not a mismatch.
  const activeEntries = useMemo(() => {
    if (!albumIdValid || !rotationEntries) return [];
    return rotationEntries.filter(
      (entry): entry is AlbumEntry & { rotation_id: number } =>
        entry.id === album.id && typeof entry.rotation_id === "number",
    );
  }, [rotationEntries, album.id, albumIdValid]);

  // Undecidable until the first load lands. A failed first load must not
  // fall through to the Add picker — that would offer a second insert on an
  // album whose actual rotation membership is simply unknown, not "none".
  const rotationStateUnknown = rotationEntries === undefined;

  // Both mutations invalidate the rotation list and this control's state only
  // flips once that refetch lands, so the actions stay busy while it is in
  // flight — including the first load, when membership isn't known yet. That
  // window is exactly where a second submit would open a duplicate active
  // entry for the same album, which the backend's bare insert would accept.
  const addBusy = addPending || rotationFetching;

  // `killPending` and `rotationFetching` are both control-wide — the mutation
  // hook is a single instance shared by every row, and the invalidation
  // refetch it triggers updates the one list all rows read. Gating by
  // `killTargetId` (set to the rotation_id a kill was issued for) scopes the
  // busy signal to the row that started it; otherwise killing one bin's entry
  // would spin every other active bin's Kill button as if it were being
  // retired too.
  const isRowKillBusy = (rotationId: number) =>
    killTargetId === rotationId && (killPending || rotationFetching);

  const handleAdd = async () => {
    if (!selectedBin || !albumIdValid) return;
    try {
      await addRotationEntry({
        album_id: album.id,
        rotation_bin: selectedBin,
      }).unwrap();
      setSelectedBin(null);
    } catch {
      toast.error("Failed to add to rotation");
    }
  };

  const handleKill = async (rotationId: number) => {
    setKillTargetId(rotationId);
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

  // `RotationBinSelector` and the Add button can't act on a synthesized id —
  // there is no library row for the backend's rotation insert to reference —
  // so rendering them here would be a picker that always ends in a
  // permanently-disabled button with no explanation, not a real affordance.
  if (!albumIdValid) {
    return (
      <Chip size="sm" variant="soft" color="neutral">
        Not linked to a library album — can&apos;t be classified
      </Chip>
    );
  }

  if (rotationStateUnknown) {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Chip size="sm" variant="soft" color={rotationErrored ? "danger" : "neutral"}>
          {rotationErrored
            ? "Rotation status unavailable"
            : "Checking rotation status…"}
        </Chip>
        {rotationErrored && (
          <Button size="sm" variant="soft" onClick={() => refetchRotation()}>
            Retry
          </Button>
        )}
      </Stack>
    );
  }

  if (activeEntries.length > 0) {
    return (
      <Stack spacing={1}>
        {activeEntries.map((entry) => (
          <Stack
            key={entry.rotation_id}
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Chip size="sm" variant="soft">
              In Rotation ({entry.rotation_bin})
            </Chip>
            <Button
              size="sm"
              color="warning"
              variant="soft"
              loading={isRowKillBusy(entry.rotation_id)}
              onClick={() => handleKill(entry.rotation_id)}
            >
              Kill {entry.rotation_bin}
            </Button>
          </Stack>
        ))}
      </Stack>
    );
  }

  return (
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
