'use client';
import React, { useEffect, useState } from "react";
import useMousePosition from "../widgets/MousePosition";

import FlowsheetEntry from "./FlowsheetEntry";
import { flowSheetSlice, getEntries, getEntryClientRect, getEntryPlaceholderIndex, getQueue, getQueuePlaceholderIndex, useDispatch, useSelector } from "@/lib/redux";

const DraggingPreview = () => {

    const dispatch = useDispatch();

    const queue = useSelector(getQueue);
    const entries = useSelector(getEntries);
    const queuePlaceholderIndex = useSelector(getQueuePlaceholderIndex);
    const setQueuePlaceholderIndex = (index: number) => dispatch(flowSheetSlice.actions.setQueuePlaceholderIndex(index));
    const entryPlaceholderIndex = useSelector(getEntryPlaceholderIndex);
    const setEntryPlaceholderIndex = (index: number) => dispatch(flowSheetSlice.actions.setEntryPlaceholderIndex(index));
    const entryClientRect = useSelector(getEntryClientRect);
    const switchQueue = (from: number, to: number) => dispatch(flowSheetSlice.actions.switchQueue({ from, to }));
    const switchEntry = (from: number, to: number) => dispatch(flowSheetSlice.actions.switchEntry({ from, to }));


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