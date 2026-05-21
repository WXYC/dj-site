"use client";

import "@/src/styles/classic/flowsheet.css";
import { useFlowsheet, useShowControl } from "@/src/hooks/flowsheetHooks";
import { useRegistry } from "@/src/hooks/authenticationHooks";
import { useState, useMemo } from "react";
import ActionsBar from "../ActionsBar";
import EntryForm from "../EntryForm";
import EntryTable from "../EntryTable";
import FontSizeAdjuster from "../FontSizeAdjuster";
import Navigation from "../../Navigation";
import StartShow from "../StartShow";
import {
  isFlowsheetStartShowEntry,
  FlowsheetEntry,
  UpdateRequestBody,
} from "@/lib/features/flowsheet/types";
import { useAddToFlowsheetMutation, useSwitchEntriesMutation } from "@/lib/features/flowsheet/api";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";

export default function Main() {
  const { entries, removeFromFlowsheet, updateFlowsheet, loading } =
    useFlowsheet();
  const { live, currentShow } = useShowControl();
  const { info: userData } = useRegistry();
  const [fontSize, setFontSize] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(3);
  const [addToFlowsheet] = useAddToFlowsheetMutation();
  const [switchEntries] = useSwitchEntriesMutation();

  const currentShowEntries = entries.current;
  const previousEntries = entries.previous;

  const showInfo = useMemo(() => {
    if (!currentShowEntries || currentShowEntries.length === 0) {
      return null;
    }
    // Find start show entry
    const startEntry = currentShowEntries.find(isFlowsheetStartShowEntry);
    if (startEntry) {
      return {
        date: startEntry.day,
        timeRange: startEntry.time,
        djName: startEntry.dj_name || userData?.real_name || "Unknown DJ",
      };
    }
    return {
      date: new Date().toLocaleDateString(),
      timeRange: new Date().toLocaleTimeString(),
      djName: userData?.real_name || "Unknown DJ",
    };
  }, [currentShowEntries, userData]);

  const workingHour = useMemo(() => {
    // Calculate working hour from current time
    return Date.now();
  }, []);

  const handleAddTalkset = async () => {
    try {
      await addToFlowsheet({ message: "Talkset", entry_type: FlowsheetEntryType.talkset }).unwrap();
    } catch (error) {
      console.error("Failed to add talkset:", error);
    }
  };

  const handleAddBreakpoint = async () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    const timeString = `${displayHour}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    try {
      await addToFlowsheet({
        message: `${timeString} Breakpoint`,
        entry_type: FlowsheetEntryType.breakpoint,
      }).unwrap();
    } catch (error) {
      console.error("Failed to add breakpoint:", error);
    }
  };

  const handleUpdate = (entryId: number, data: UpdateRequestBody) => {
    updateFlowsheet({ entry_id: entryId, data });
  };

  const handleDelete = (entryId: number) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      removeFromFlowsheet(entryId);
    }
  };

  const handleReorder = async (sourceId: number, targetId: number) => {
    const target = currentShowEntries.find((e) => e.id === targetId);
    if (!target || !("play_order" in target)) return;
    try {
      await switchEntries({
        entry_id: sourceId,
        new_position: target.play_order,
      }).unwrap();
    } catch (error) {
      console.error("Failed to reorder entries:", error);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center" }} className="text">
        <p>Loading flowsheet...</p>
      </div>
    );
  }

  // Show StartShow component when not live
  if (!live) {
    return (
      <div style={{ width: "100%", margin: "0 auto" }}>
        <Navigation />
        <StartShow />
      </div>
    );
  }

  // Show flowsheet when live
  return (
    <div style={{ width: "100%", margin: "0 auto" }}>
      <Navigation />
      <ActionsBar
        onAddTalkset={handleAddTalkset}
        onAddBreakpoint={handleAddBreakpoint}
        workingHour={workingHour}
      />
      <hr />
      <EntryForm onSuccess={() => {}} isLive={live} />
      <hr />
      <div className="redlabel" style={{ textAlign: "center" }}>
        &nbsp;
      </div>
      <hr />
      <div style={{ textAlign: "center" }}>
        <table
          cellPadding={2}
          cellSpacing={2}
          border={0}
          style={{ backgroundColor: "#AAAAAA", width: "100%" }}
        >
          <tbody>
            <tr>
              <th style={{ width: "25%", textAlign: "left" }} className="redlabel">
                <span className="text-override-black" style={{ color: "black" }}>
                  Date of Show: {showInfo?.date || "N/A"}
                  <br />
                  Hours: {showInfo?.timeRange || "N/A"}
                </span>
              </th>
              <th>
                <FontSizeAdjuster onFontSizeChange={setFontSize} />
              </th>
              <th
                style={{ width: "25%", textAlign: "center", backgroundColor: "#AAAAAA" }}
                className="redlabel"
              >
                <span className="text-override-black" style={{ color: "black" }}>
                  Disc Jockey: {showInfo?.djName || "N/A"}&nbsp;
                </span>
              </th>
            </tr>
          </tbody>
        </table>
        <EntryTable
          entries={currentShowEntries}
          previousEntries={previousEntries}
          fontSize={fontSize}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      </div>
    </div>
  );
}
