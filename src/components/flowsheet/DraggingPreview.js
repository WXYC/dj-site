import React, { useEffect, useState } from "react";
import { useFlowsheet } from "../../services/flowsheet/flowsheet-context";
import useMousePosition from "../../widgets/MousePosition";

import FlowsheetEntry from "./FlowsheetEntry";

const DraggingPreview = () => {

    const {
        queue,
        entries,
        queuePlaceholderIndex,
        setQueuePlaceholderIndex,
        entryPlaceholderIndex,
        setEntryPlaceholderIndex,
        entryClientRect,
        switchQueue,
        switchEntry
    } = useFlowsheet();

    const mousePosition = useMousePosition();

    const [draggedQueueMovedBy, setDraggedQueueMovedBy] = useState(0);
    useEffect(() => {
        if (queuePlaceholderIndex < 0) return;

        let diff = (entryClientRect?.y ?? 0) - (mousePosition?.y ?? 0) + ((entryClientRect?.height ?? 0) / 2);
        let blocs = Math.round(diff / (entryClientRect?.height ?? 1));
        setDraggedQueueMovedBy(blocs);
    }, [mousePosition, entryClientRect]);

    useEffect(() => {
        if (queuePlaceholderIndex < 0) return;

        let newPosition = Math.min(Math.max(0, queuePlaceholderIndex - draggedQueueMovedBy), queue.length - 1);
        if (newPosition == queuePlaceholderIndex) return;
        switchQueue(queuePlaceholderIndex, newPosition);
        setQueuePlaceholderIndex(newPosition);
    }, [draggedQueueMovedBy]);

    const [draggedEntryMovedBy, setDraggedEntryMovedBy] = useState(0);
    useEffect(() => {
        if (entryPlaceholderIndex < 0) return;

        let diff = (entryClientRect?.y ?? 0) - (mousePosition?.y ?? 0) + ((entryClientRect?.height ?? 0) / 2);
        let blocs = Math.round(diff / (entryClientRect?.height ?? 1));
        setDraggedEntryMovedBy(blocs);
    }, [mousePosition, entryClientRect]);

    useEffect(() => {
        if (entryPlaceholderIndex < 0) return;

        let newPosition = Math.min(Math.max(0, entryPlaceholderIndex - draggedEntryMovedBy), entries.length - 1);
        if (newPosition == entryPlaceholderIndex) return;
        switchEntry(entryPlaceholderIndex, newPosition);
        setEntryPlaceholderIndex(newPosition);
    }, [draggedEntryMovedBy]);
    
    return (queuePlaceholderIndex > -1) ? (
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
          ) : (entryPlaceholderIndex > -1) ? (
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
                    setEntryPlaceholderIndex(-1);
                }}
            >
                <FlowsheetEntry
                    index = {entryPlaceholderIndex}
                    key={`entry-preview-${entryPlaceholderIndex}`}
                    type={"entry"}
                    {...entries[entryPlaceholderIndex]}
                />
            </div>
            ) : null;
}

export default DraggingPreview;