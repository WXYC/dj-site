import React, {createContext, useContext, useEffect, useRef, useState} from "react";
import { getSongInfoFromLastFM } from "../artwork/last-fm-image";
import { toast } from "sonner";

const FlowsheetContext = createContext();

export const useFlowsheet = () => useContext(FlowsheetContext);

export const FlowsheetProvider = ({children}) => {

    const [queue, setQueue] = useState([]);
    const [entries, setEntries] = useState([]);
    const [edited, setEdited] = useState(false);
    const [breakpointAllowed, setBreakpointAllowed] = useState(true);
    const [autoPlay, setAutoPlay] = useState(false);
    const [currentlyPlayingSongLength, setCurrentlyPlayingSongLength] = useState({ h: 0, m: 0, s: 0, total: 0 });
    const [currentTimeStamp, setCurrentTimeStamp] = useState({ h: 0, m: 0, s: 0, total: 0 });
    const [counter, setCounter] = useState(null); // used to kill timeouts
    const [gettingSongLength, setGettingSongLength] = useState(true); // used to kill timeouts

    // Placeholder indices that allow editing the order of the queue and entries
    const [queuePlaceholderIndex, setQueuePlaceholderIndex] = useState(-1);
    const [entryPlaceholderIndex, setEntryPlaceholderIndex] = useState(-1);
    const [entryClientRect, setEntryClientRect] = useState(null); // Used to determine the size of the entry placeholder

    const addToQueue = (item) => {
        if (item.artist != null && typeof item.artist == "object") {
            let newItem = {
                message: "",
                title: "",
                artist: item.artist.name,
                album: item.title,
                label: item.label
            };
            item = newItem;
        }

        let newQueue = [item, ...queue];
        index(newQueue);
        setQueue(newQueue);
        localStorage.setItem("queue", JSON.stringify([item, ...queue]));
    }

    const removeFromQueue = (id) => {
        let newQueue = queue.filter((item) => item.id !== id);
        index(newQueue);
        setQueue(newQueue);
        localStorage.setItem("queue", JSON.stringify(queue.filter((item) => item.id !== id)));
    }

    const addToEntries = (entry) => {
        let newEntries = [entry, ...entries];
        index(newEntries);
        
        autoPlay && entry.message == "" && dispatchAutoPlayOfSong(entry);

        setEntries(newEntries);
    }

    useEffect(() => {
        if (autoPlay && entries.length > 0 && entries[0].message === "") {
            dispatchAutoPlayOfSong(entries[0]);
        }
    }, [autoPlay]);

    const dispatchAutoPlayOfSong = async (entry) => {
        try {
            setGettingSongLength(true);
            let data = await getSongInfoFromLastFM({title: entry.title, artist: entry.artist});

            if (!data) {
                toast.error("Song duration not found, autoplay disabled");
                setAutoPlay(false);
                return;
            }

            let duration = Number(data?.track?.duration ?? 0);
            if (duration <= 0) {
                toast.error("Song duration not found, autoplay disabled");
                setAutoPlay(false);
                return;
            }
            // duration is in milliseconds
            let h = Math.floor(duration / 3600000);
            let m = Math.floor((duration % 3600000) / 60000);
            let s = Math.floor(((duration % 3600000) % 60000) / 1000);
            let total = (Math.floor(duration / 1));
            setCurrentTimeStamp({ h, m, s, total });
            setCurrentlyPlayingSongLength({ h, m, s, total });
            setGettingSongLength(false);
        } catch (error) {
            toast.error("Song duration not found, autoplay disabled");
            console.log(error);
            setAutoPlay(false);
            return;
        }
    }

    useEffect(() => {
        const dispatchSecondwiseDecrement = () => {
            clearTimeout(counter);
            setCounter(setTimeout(() => {
                setCurrentTimeStamp((prev) => {
                    let { h, m, s, total } = prev;
                    if (s == 0) {
                        if (m == 0) {
                            if (h == 0) {
                                return { h: 0, m: 0, s: 0, total: 0 };
                            } else {
                                return { h: h - 1, m: 59, s: 59, total: total - 1000 };
                            }
                        } else {
                            return { h, m: m - 1, s: 59, total: total - 1000 };
                        }
                    } else {
                        return { h, m, s: s - 1, total: total - 1000 };
                    }
                });

                if (currentTimeStamp.total > 0) dispatchSecondwiseDecrement();
            }, 1000));
        }

        clearTimeout(counter);
        dispatchSecondwiseDecrement();

        return () => {
            clearTimeout(counter);
        }
    }, [currentlyPlayingSongLength]);

    useEffect(() => {
        if (autoPlay && currentTimeStamp.total <= 0 && queue.length > 0) {
            if (!gettingSongLength) playOffTop();
        }
    }, [currentTimeStamp]);

    const playOffTop = () => {
        let entry = queue[queue.length - 1];
        removeFromQueue(entry.id);
        addToEntries(entry);
    }

    const removeFromEntries = (id) => {
        let newEntries = entries.filter((item) => item.id !== id);
        index(newEntries);
        setEntries(newEntries);
    }

    const clearQueue = () => {
        setQueue([]);
    }

    const updateQueueEntry = (id, label, value) => {
        let newQueue = [...queue];
        newQueue[id][label] = value;
        setQueue(newQueue);
        localStorage.setItem("queue", JSON.stringify(newQueue));
    }

    const updateEntry = (id, label, value) => {
        let newEntries = [...entries];
        newEntries[id][label] = value;
        setEntries(newEntries);
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
        index(newQueue);
        setQueue(newQueue);
        localStorage.setItem("queue", JSON.stringify(newQueue));
    }

    const index = (set) => {
        for (let i = set.length - 1; i >= 0; i--) {
            set[i].id = i;
        }
    }

    const switchEntry = (index1, index2) => {
        let newEntries = [...entries];
        let temp = newEntries[index1];
        newEntries[index1] = newEntries[index2];
        newEntries[index2] = temp;
        index(newEntries);

        if (index1 == 0 || index2 == 0) {
            if (autoPlay && newEntries[0].message === "") {
                dispatchAutoPlayOfSong(newEntries[0]);
            }
        }

        setEntries(newEntries);
    }

    useEffect(() => {
        console.log("This is where we initialize the entries to the flowsheet, not yet implemented");
        updateWithBackend();
        localStorage.getItem("queue") && setQueue(JSON.parse(localStorage.getItem("queue")));

        setAutoPlay(false);
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
                switchEntry,
                autoPlay,
                setAutoPlay,
                currentlyPlayingSongLength,
                currentTimeStamp,
                playOffTop,
                updateQueueEntry,
                updateEntry,
            }}
        >
            {children}
        </FlowsheetContext.Provider>
    );
}