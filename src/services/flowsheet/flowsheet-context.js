import React, {createContext, useContext, useEffect, useState} from "react";

const FlowsheetContext = createContext();

export const useFlowsheet = () => useContext(FlowsheetContext);

export const FlowsheetProvider = ({children}) => {

    const [queue, setQueue] = useState([]);
    const [entries, setEntries] = useState([]);
    const [edited, setEdited] = useState(false);
    const [breakpointAllowed, setBreakpointAllowed] = useState(true);

    // Placeholder indices that allow editing the order of the queue and entries
    const [queuePlaceholderIndex, setQueuePlaceholderIndex] = useState(-1);
    const [entryPlaceholderIndex, setEntryPlaceholderIndex] = useState(-1);
    const [entryClientRect, setEntryClientRect] = useState(null); // Used to determine the size of the entry placeholder

    const addToQueue = (item) => {
        item['id'] = queue.length + 1;
        setQueue([item, ...queue]);
        localStorage.setItem("queue", JSON.stringify([item, ...queue]));
    }

    const removeFromQueue = (id) => {
        setQueue(queue.filter((item) => item.id !== id));
        localStorage.setItem("queue", JSON.stringify(queue.filter((item) => item.id !== id)));
    }

    const addToEntries = (entry) => {
        entry['id'] = entries.length + 1;
        setEntries([entry, ...entries]);
    }

    const removeFromEntries = (id) => {
        setEntries(entries.filter((item) => item.id !== id));
    }

    const clearQueue = () => {
        setQueue([]);
    }

    const updateWithBackend = () => {
        if (edited) {
            console.log("This is where we update the backend with the entries, not yet implemented");
            setEdited(false);
        }
        setTimeout(updateWithBackend, 60000); // Update every 1 minute
    }

    const updateFlowsheet = () => {
        setEdited(true);
    }

    const switchQueue = (index1, index2) => {
        let newQueue = [...queue];
        let temp = newQueue[index1];
        newQueue[index1] = newQueue[index2];
        newQueue[index2] = temp;
        setQueue(newQueue);
        localStorage.setItem("queue", JSON.stringify(newQueue));
    }

    const switchEntry = (index1, index2) => {
        let newEntries = [...entries];
        let temp = newEntries[index1];
        newEntries[index1] = newEntries[index2];
        newEntries[index2] = temp;
        setEntries(newEntries);
    }

    useEffect(() => {
        console.log("This is where we initialize the entries to the flowsheet, not yet implemented");
        updateWithBackend();
        localStorage.getItem("queue") && setQueue(JSON.parse(localStorage.getItem("queue")));
    }, []);

    return (
        <FlowsheetContext.Provider 
            value={{ 
                queue, 
                entries, 
                addToQueue, 
                removeFromQueue, 
                addToEntries, 
                removeFromEntries, 
                clearQueue, 
                updateFlowsheet, 
                queuePlaceholderIndex, 
                entryPlaceholderIndex, 
                setQueuePlaceholderIndex, 
                setEntryPlaceholderIndex,
                entryClientRect,
                setEntryClientRect,
                switchQueue,
                switchEntry
            }}
        >
            {children}
        </FlowsheetContext.Provider>
    );
}