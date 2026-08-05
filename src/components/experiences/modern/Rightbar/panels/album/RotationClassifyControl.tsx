"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Chip, FormControl, FormLabel, Stack } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import {
  useAddRotationEntryMutation,
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
 * `useKillRotationEntryMutation`. Add and kill are two states of one
 * control, switched on whether the album already carries a `rotation_id` —
 * mount with `key={album.id}` from the caller so local state reseeds from
 * `album` rather than leaking the prior album's in-progress bin pick.
 */
function RotationClassifyControl({ album }: RotationClassifyControlProps) {
  const [addRotationEntry, { isLoading: addPending }] = useAddRotationEntryMutation();
  const [killRotationEntry, { isLoading: killPending }] = useKillRotationEntryMutation();

  const [rotationId, setRotationId] = useState(album.rotation_id ?? null);
  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);

  const handleAdd = async () => {
    if (!selectedBin) return;
    try {
      const entry = await addRotationEntry({
        album_id: album.id,
        rotation_bin: selectedBin,
      }).unwrap();
      setRotationId(entry.id);
    } catch {
      toast.error("Failed to add to rotation");
    }
  };

  const handleKill = async () => {
    if (rotationId === null) return;
    try {
      await killRotationEntry({ rotation_id: rotationId, kill_date: new Date() }).unwrap();
      setRotationId(null);
      setSelectedBin(null);
    } catch {
      toast.error("Failed to kill rotation entry");
    }
  };

  return (
    <RequireMD>
      {rotationId !== null ? (
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
            loading={killPending}
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
              disabled={addPending}
            />
            <Button
              size="sm"
              disabled={!selectedBin}
              loading={addPending}
              onClick={handleAdd}
            >
              Add to Rotation
            </Button>
          </Stack>
        </FormControl>
      )}
    </RequireMD>
  );
}

export default RotationClassifyControl;
