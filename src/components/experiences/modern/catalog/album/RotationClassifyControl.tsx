"use client";

import { useState } from "react";
import { Button, Chip, Stack } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useAlbumRotationEntries } from "./useAlbumRotationEntries";
import { useAlbumRotationActions } from "./useAlbumRotationActions";
import { Rotation } from "@/lib/features/rotation/types";
import { AlbumEntry } from "@/lib/features/catalog/types";
import FormSectionCard from "@/src/components/shared/FormSectionCard";
import CatalogRotationBinPicker from "@/src/components/experiences/modern/catalog/CatalogRotationBinPicker";

interface RotationClassifyControlProps {
  album: AlbumEntry;
}

/**
 * MD+ control for rotation classification, backed by `useAlbumRotationActions`
 * — the write hook shared with the catalog row's context menu. Picking a bin
 * always calls `setRotation`, which adds the picked bin and only then retires
 * every previously active entry, so re-binning is a single gesture here too and
 * a failure never drops the album out of rotation altogether. Each active entry
 * also carries its own Kill button for plain removal.
 *
 * The fields live in a child so their hooks — including the rotation-list
 * query the active-entries list is derived from — run only for an authorized
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
  const { setRotation, kill, isKilling, isAnyKillInFlight, isSettingRotation } =
    useAlbumRotationActions(album);

  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);

  // `setRotation`'s add step invalidates the rotation list, and this
  // control's state only flips once that refetch lands, so `busy` stays true
  // through the window between a successful write and the list update —
  // otherwise a second submit there would open a duplicate active entry for
  // the same album, which the backend's bare insert would accept.
  // `rotationFetching` is also true during the very first load, before
  // membership is known at all, but that window never reaches this form: the
  // `rotationStateUnknown` early return below renders a status chip in its
  // place instead.
  // `isAnyKillInFlight` is folded in so a row kill and a set can't overlap:
  // without it the Add button stays live during a kill, and the set would
  // re-issue a retire for the very entry already being killed — whose shared
  // busy-state entry is then cleared by whichever request settles first,
  // un-spinning the row while the other is still open.
  const busy = isSettingRotation || isAnyKillInFlight || rotationFetching;

  const handleSetRotation = async () => {
    if (!selectedBin || !albumIdValid) return;
    // Keep the pick on failure: the operator is one click from a retry, and
    // clearing it would make them re-open the picker at exactly the moment
    // the write did not land.
    if (await setRotation(selectedBin, activeEntries)) {
      setSelectedBin(null);
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
            loading={isKilling(entry.rotation_id)}
            disabled={isSettingRotation}
            onClick={() => kill(entry.rotation_id)}
          >
            Kill {entry.rotation_bin}
          </Button>
        </Stack>
      ))}
      {/* Picking a bin here always goes through `setRotation`, which adds the
          new bin and then retires every entry above — re-binning is one
          gesture whether or not the album already has an active entry. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "flex-end", justifyContent: "space-between" }}
      >
        <CatalogRotationBinPicker
          selectedBin={selectedBin}
          onSelectBin={setSelectedBin}
          disabled={busy}
        />
        <Button
          color="success"
          size="sm"
          disabled={!selectedBin}
          loading={busy}
          onClick={handleSetRotation}
        >
          {/* Not "Add to Rotation": the gesture replaces whatever bins the
              album is in, and "Set" is equally true of the first one. */}
          Set Rotation
        </Button>
      </Stack>
    </Stack>
  );
}

export default RotationClassifyControl;
