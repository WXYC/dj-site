import {
  Divider,
  Sheet,
  Stack
} from "@mui/joy";
import React, { useEffect } from "react";
import AddToFlowsheetSearch from "../../components/flowsheet/AddToFlowsheetSearch";
import FlowsheetEntry from "../../components/flowsheet/FlowsheetEntry";
import { useFlowsheet } from "../../services/flowsheet/flowsheet-context";
import useMousePosition from "../../widgets/MousePosition";
  
/**
 * @page
 * @category Flowsheet
 * @description The FlowsheetPage component is the wrapper for the flowsheet view.
 * It provides the add to flowsheet search bar and the flowsheet entries.
 * @returns {JSX.Element} The rendered FlowSheetPage component.
 */
  const FlowSheetPage = () => {

    const { 
      queue, 
      entries, 
      queuePlaceholderIndex, 
      setQueuePlaceholderIndex,
      entryPlaceholderIndex,
      setEntryPlaceholderIndex,
      entryClientRect
    } = useFlowsheet();

    const mousePosition = useMousePosition();

    useEffect(() => {
      console.log(entryClientRect);
    }, [entryClientRect]);

    // THIS IS WHERE THE PAGE RENDER BEGINS ---------------------------------------------
    return (
      <div>
        {(queuePlaceholderIndex > -1) && (
          <div
            style = {{
              position: "absolute",
              zIndex: 20000,
              top: (mousePosition?.y ?? 0) - (entryClientRect?.offsetY ?? 0),
              left: (mousePosition?.x ?? 0) - (entryClientRect?.offsetX ?? 0),
              width: entryClientRect?.x ?? 0,
              height: entryClientRect?.y ?? 0,
            }}
            onMouseUp={() => {
              setQueuePlaceholderIndex(-1);
            }}
          >
            <FlowsheetEntry
              index = {queuePlaceholderIndex}
              key={`queue-preview-${queuePlaceholderIndex}`}
              type={"queue"}
              {...queue[queuePlaceholderIndex]}
            />
          </div>
        )}
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
              return (index == queuePlaceholderIndex) ? 
               (
                <FlowsheetEntry
                  key={`queue-${index}`}
                  type={"placeholder"}
                />
               )
               : (
                <FlowsheetEntry
                  index = {index}
                  key={`queue-${index}`}
                  type={"queue"}
                  {...entry}
                />
                );
            })}
            </Stack>
        <Divider sx = {{ my: 1 }} />
          <Stack direction="column" spacing={1}>
            {entries.map((entry, index) => {
              return (index == entryPlaceholderIndex) ? 
              (
                <FlowsheetEntry
                  key={`entry-${index}`}
                  type={"placeholder"}
                />
              )
              : (
                <FlowsheetEntry
                  index = {index}
                  key={`entry-${index}`}
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
  