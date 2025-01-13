"use client";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { getClassic } from "@/lib/slices/application/selectors";
import { applicationSlice } from "@/lib/slices/application/slice";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AutoFixOffIcon from "@mui/icons-material/AutoFixOff";
import { Tooltip } from "@mui/joy";
import IconButton from "@mui/joy/IconButton";
import { Suspense, useEffect } from "react";
import { fetchViewMode, saveViewMode } from "./styleHandlers";

interface ViewStyleToggleProps {
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function ViewStyleToggle(props: ViewStyleToggleProps): JSX.Element {
  const classic = useAppSelector(getClassic);
  const dispatch = useAppDispatch();

  const handleViewChange = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    let newMode: "modern" | "classic" = classic ? "modern" : "classic";
    saveViewMode(newMode).then(() => {
      dispatch(applicationSlice.actions.toggleClassic());
    });
  };

  useEffect(() => {
    document
      .querySelector("html")
      ?.setAttribute("data-classic-view", classic ? "true" : "false");
  }, [classic]);


  useEffect(() => {
    fetchViewMode().then((viewMode) => {
      dispatch(applicationSlice.actions.setClassic(viewMode === "classic"));
    });
  }, [classic]);

  return (
    <Suspense
      fallback={
        <IconButton size="sm" variant="plain" color="neutral" disabled>
          <AutoFixOffIcon />
        </IconButton>
      }
    >
      <Tooltip
        title={`Switch to ${classic ? "new" : "classic"} view`}
        size="sm"
        placement="bottom"
        variant="outlined"
      >
        <IconButton
          id="toggle-mode"
          size="sm"
          variant="plain"
          color="neutral"
          {...props}
          onClick={handleViewChange}
        >
          {classic ? <AutoFixHighIcon /> : <AutoFixOffIcon />}
        </IconButton>
      </Tooltip>
    </Suspense>
  );
}
