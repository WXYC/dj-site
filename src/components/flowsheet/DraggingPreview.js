import React, { useEffect } from "react";
import { useFlowsheet } from "../../services/flowsheet/flowsheet-context";
import useMousePosition from "../../widgets/MousePosition";

import FlowsheetEntry from "./FlowsheetEntry";

const DraggingPreview = ({ entry }) => {

    const {
        queue,
        queuePlaceholderIndex,
        setQueuePlaceholderIndex,
        entryPlaceholderIndex,
        setEntryPlaceholderIndex,
        entryClientRect
    } = useFlowsheet();

    const mousePosition = useMousePosition();

    useEffect(() => {
        let diff = (entryClientRect?.y ?? 0) - (mousePosition?.y ?? 0) + ((entryClientRect?.height ?? 0) / 2);
        let blocs = Math.round(diff / (entryClientRect?.height ?? 1));
    }, [mousePosition, entryClientRect]);
    
    return (queuePlaceholderIndex > -1) && (
            <div
              style = {{
                position: "absolute",
                zIndex: 20000,
                left: (mousePosition?.x ?? 0) - (entryClientRect?.offsetX ?? 0),
                top: (mousePosition?.y ?? 0) - (entryClientRect?.offsetY ?? 0),
                width: entryClientRect?.width ?? 0,
                height: entryClientRect?.height ?? 0,
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
          );
}

export default DraggingPreview;