"use client";

import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import { IconButton } from "@mui/joy";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { applicationSlice } from "@/lib/features/application/frontend";

export default function RightbarMiniSwitcher() {
  const dispatch = useAppDispatch();
  const mini = useAppSelector(applicationSlice.selectors.getRightbarMini);

  const handleToggle = () => {
    dispatch(applicationSlice.actions.setRightbarMini(!mini));
  };

  return (
    <IconButton
      size="sm"
      variant="plain"
      color="neutral"
      onClick={handleToggle}
    >
      {mini ? <ArrowDropDown /> : <ArrowDropUp />}
    </IconButton>
  );
}
