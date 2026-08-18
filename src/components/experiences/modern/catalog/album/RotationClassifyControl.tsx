"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Chip, Stack } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import {
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
} from "@/lib/features/rotation/api";
import { useAlbumRotationEntries } from "./useAlbumRotationEntries";
import { Rotation } from "@/lib/features/rotation/types";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import FormSectionCard from "@/src/components/shared/FormSectionCard";
import CatalogRotationBinPicker from "@/src/components/experiences/modern/catalog/CatalogRotationBinPicker";

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
      <FormSectionCard title="Rotation" data-testid="rotation-section-card">
        <RotationClassifyFields album={album} />
      </FormSectionCard>
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
  const [killRotationEntry] = useKillRotationEntryMutation();

  // The album-detail read (`GET /library/info`) joins no rotation table and
  // selects no rotation columns, so `album.rotation_id` is always undefined
  // here — whether the album is in rotation is only answerable from the
  // active-rotation list.
  const {
    activeEntries,
    albumIdValid,
    rotationStateUnknown,
    rotationFetching,
    rotationErrored,
    refetchRotation,
  } = useAlbumRotationEntries(album);

  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);
  const [inFlightKillIds, setInFlightKillIds] = useState<Set<number>>(
    () => new Set(),
  );

  // The add mutation invalidates the rotation list, and this control's state
  // only flips once that refetch lands, so `addBusy` stays true through the
  // window between a successful POST and the list update — otherwise a
  // second submit there would open a duplicate active entry for the same
  // album, which the backend's bare insert would accept. `rotationFetching`
  // is also true during the very first load, before membership is known at
  // all, but that window never reaches this form: the `rotationStateUnknown`
  // early return below renders a status chip in its place, so there is no
  // Add affordance yet for `addBusy` to guard.
  const addBusy = addPending || rotationFetching;

  // Tracked as a set of `rotation_id`s, not a single scalar: the kill
  // mutation hook is one instance shared by every row, so a second kill
  // issued while a first is still open must not clear the first row's busy
  // state. Each id is added when that row's kill starts and removed once
  // that same request settles — fulfilled or rejected — so a row reads busy
  // iff its own kill is in flight, independent of any other row's.
  const isRowKillBusy = (rotationId: number) => inFlightKillIds.has(rotationId);

  const handleAdd = async () => {
    if (!selectedBin || !albumIdValid) return;
    try {
      await addRotationEntry({
        // Guarded by the `albumIdValid` check above.
        album_id: album.id!,
        rotation_bin: selectedBin,
      }).unwrap();
      setSelectedBin(null);
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to add to rotation");
      }
    }
  };

  const handleKill = async (rotationId: number) => {
    setInFlightKillIds((prev) => new Set(prev).add(rotationId));
    try {
      // `kill_date` is omitted so the server dates the kill itself. Computing
      // it here would yield the browser's UTC calendar day, which is already
      // tomorrow during Eastern evening hours; the rotation read keeps entries
      // whose kill_date is in the future, so a tomorrow-dated kill would leave
      // the retired album selectable in the flowsheet picker for another day.
      await killRotationEntry({ rotation_id: rotationId }).unwrap();
      setSelectedBin(null);
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to kill rotation entry");
      }
    } finally {
      setInFlightKillIds((prev) => {
        const next = new Set(prev);
        next.delete(rotationId);
        return next;
      });
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
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "flex-end", justifyContent: "space-between" }}
    >
      <CatalogRotationBinPicker
        selectedBin={selectedBin}
        onSelectBin={setSelectedBin}
        disabled={addBusy}
      />
      <Button
        color="success"
        size="sm"
        disabled={!selectedBin}
        loading={addBusy}
        onClick={handleAdd}
      >
        Add to Rotation
      </Button>
    </Stack>
  );
}

export default RotationClassifyControl;
