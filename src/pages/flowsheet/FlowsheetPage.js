import {
  Divider,
  Sheet,
  Stack
} from "@mui/joy";
import React from "react";
import AddToFlowsheetSearch from "../../components/flowsheet/AddToFlowsheetSearch";
import FlowsheetEntry from "../../components/flowsheet/FlowsheetEntry";
import { useFlowsheet } from "../../services/flowsheet/flowsheet-context";
  
/**
 * @page
 * @category Flowsheet
 * @description The FlowsheetPage component is the wrapper for the flowsheet view.
 * It provides the add to flowsheet search bar and the flowsheet entries.
 * @returns {JSX.Element} The rendered FlowSheetPage component.
 */
  const FlowSheetPage = () => {

    const { queue, entries } = useFlowsheet();

    // THIS IS WHERE THE PAGE RENDER BEGINS ---------------------------------------------
    return (
      <div>
      {/* HEADER AREA */}
      <AddToFlowsheetSearch />
        {/* FLOWSHEET AREA */}
        <Sheet
          sx={{
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
            background: "transparent",
            mt: 2,
          }}
        >
            <Stack direction="column" spacing={1}>
            {queue.map((entry, index) => {
                if (entry.message.length > 0) return null;
              return (
                <FlowsheetEntry
                  type={"queue"}
                  {...entry}
                />
                );
            })}
            </Stack>
        <Divider sx = {{ my: 1 }} />
          <Stack direction="column" spacing={1}>
            {entries.map((entry, index) => {
              return (
                <FlowsheetEntry
                  type={
                    entry?.message?.length > 0
                      ? entry?.message?.includes("joined")
                        ? "joined"
                        : entry?.message?.includes("left")
                        ? "left"
                        : entry?.message?.includes("Breakpoint")
                        ? "breakpoint"
                        : entry?.message?.includes("Talkset")
                        ? "talkset"
                        : "error"
                      : "entry"
                  }
                  current={index === 0}
                  {...entry}
                />
              );
            })}
          </Stack>
        </Sheet>
      </div>
    );
  };
  
  export default FlowSheetPage;
  