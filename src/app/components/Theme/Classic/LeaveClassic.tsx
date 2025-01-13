"use client";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { getClassic } from "@/lib/slices/application/selectors";
import { applicationSlice } from "@/lib/slices/application/slice";
import { fetchViewMode, saveViewMode } from "../styleHandlers";
import { useCallback, useEffect } from "react";

export default function LeaveClassic() {
  const classic = useAppSelector(getClassic);
  const dispatch = useAppDispatch();

  const handleViewChange = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>) => {
    let newMode: "modern" | "classic" = classic ? "modern" : "classic";
    saveViewMode(newMode).then(() => {
      dispatch(applicationSlice.actions.toggleClassic());
    });
  }, [classic, dispatch]);

  useEffect(() => {
    document
      .querySelector("html")
      ?.setAttribute("data-classic-view", classic ? "true" : "false");
  }, [classic]);

  useEffect(() => {
    fetchViewMode().then((viewMode) => {
      dispatch(applicationSlice.actions.setClassic(viewMode === "classic"));
    });
  }, []);

  return (
    <a onClick={handleViewChange} href="#">
      Switch to Updated Interface
    </a>
  );
}
