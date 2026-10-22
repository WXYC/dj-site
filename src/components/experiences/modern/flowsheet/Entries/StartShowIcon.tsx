"use client";

import { Headphones } from "@mui/icons-material";
import { useGetCurrentShowQuery } from "@/lib/features/flowsheet/api";
import SpecialtyTile from "../../SpecialtyTile";

/**
 * A start-of-show row's icon: the program's tile once the open set is tagged,
 * the headphones otherwise. Only the open set's own row takes the tile, so an
 * earlier show's row keeps the headphones.
 */
export default function StartShowIcon({ showId }: { showId: number }) {
  const { data: show } = useGetCurrentShowQuery();

  if (show?.id === showId && show.specialty) {
    return <SpecialtyTile specialty={show.specialty} size={28} />;
  }

  return <Headphones sx={{ mb: -0.5, mr: 0.5 }} />;
}
