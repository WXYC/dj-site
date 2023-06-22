import React, {createContext, useContext, useEffect, useState} from "react";

const FlowsheetContext = createContext();

export const useFlowsheet = () => useContext(FlowsheetContext);

export const FlowsheetProvider = ({children}) => {

    const [queue, setQueue] = useState([]);
    const [entries, setEntries] = useState([]);
    const [edited, setEdited] = useState(false);
    const [breakpointAllowed, setBreakpointAllowed] = useState(true);

    const addToQueue = (item) => {
        setQueue([item, ...queue]);
    }

    const removeFromQueue = (entry) => {
        setQueue(queue.filter((item) => item !== entry));
    }

    const addToEntries = (entry) => {
        setEntries([entry, ...entries]);
    }

    const removeFromEntries = (entry) => {
        setEntries(entries.filter((item) => item !== entry));
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

    useEffect(() => {
        console.log("This is where we initialize the entries to the flowsheet, not yet implemented");
        updateWithBackend();
    }, []);

    return (
        <FlowsheetContext.Provider value={{ queue, entries, addToQueue, removeFromQueue, addToEntries, removeFromEntries, clearQueue, updateFlowsheet }}>
            {children}
        </FlowsheetContext.Provider>
    );
}