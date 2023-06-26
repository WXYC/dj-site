import React, {createContext, useContext, useEffect, useState} from "react";

const FlowsheetContext = createContext();

export const useFlowsheet = () => useContext(FlowsheetContext);

export const FlowsheetProvider = ({children}) => {

    const [queue, setQueue] = useState([]);
    const [entries, setEntries] = useState([]);
    const [edited, setEdited] = useState(false);
    const [breakpointAllowed, setBreakpointAllowed] = useState(true);

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

    useEffect(() => {
        console.log("This is where we initialize the entries to the flowsheet, not yet implemented");
        updateWithBackend();
        localStorage.getItem("queue") && setQueue(JSON.parse(localStorage.getItem("queue")));
    }, []);

    return (
        <FlowsheetContext.Provider value={{ queue, entries, addToQueue, removeFromQueue, addToEntries, removeFromEntries, clearQueue, updateFlowsheet }}>
            {children}
        </FlowsheetContext.Provider>
    );
}