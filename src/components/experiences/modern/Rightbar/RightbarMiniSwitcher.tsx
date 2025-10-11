"use client";

import {
  useGetRightbarQuery,
  useToggleRightbarMutation,
} from "@/lib/features/application/api";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import { IconButton } from "@mui/joy";

export default function RightbarMiniSwitcher() {
  const { data: mini, isLoading } = useGetRightbarQuery();
  const [toggleRightbar] = useToggleRightbarMutation();

  return (
    <IconButton
      size="sm"
      variant="plain"
      color="neutral"
      onClick={() => toggleRightbar()}
      disabled={isLoading}
    >
      {mini ? <ArrowDropDown /> : <ArrowDropUp />}
    </IconButton>
  );
}
