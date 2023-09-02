import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";
import { getSongInfoFromLastFM } from "../artwork/last-fm-image";
import { toast } from "sonner";
import { addSongToBackend, getFlowsheetFromBackend, removeFromFlowsheetBackend, sendMessageToBackend, updateFlowsheetEntryOnBackend } from "./flowsheet-service";

const FlowsheetContext = createContext();

export const useFlowsheet = () => useContext(FlowsheetContext);

export const FlowsheetProvider = ({children}) => {

    const [queue, setQueue] = useState([]);
    const [entries, setEntries] = useState([]);
    const edited = useRef(true);
    const [breakpointAllowed, setBreakpointAllowed] = useState(true);
    const [autoPlay, setAutoPlay] = useState(false);
    const [currentlyPlayingSongLength, setCurrentlyPlayingSongLength] = useState({ h: 0, m: 0, s: 0, total: 0 });
    const [currentTimeStamp, setCurrentTimeStamp] = useState({ h: 0, m: 0, s: 0, total: 0 });
    const [counter, setCounter] = useState(null); // used to kill timeouts
    const [gettingSongLength, setGettingSongLength] = useState(true); // used to kill timeouts

    const maxEditDepth = useRef(50);

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
                label: item.label,
                request: item.request ?? false,
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
        
        if (entry.message == "") {
            if (autoPlay) dispatchAutoPlayOfSong(entry);
            addSongToBackend(entry);
        } else {
            if (!(entry.message.includes("joined") || entry.message.includes("left"))) {
                sendMessageToBackend(entry.message);
            }
        }

        edited.current = true;
        maxEditDepth.current = maxEditDepth.current + 1;

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
            clearInterval(counter);
            setCounter(setInterval(() => {
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

                if (currentTimeStamp.total <= 0) clearInterval(counter);
            }, 1000));
        }

        dispatchSecondwiseDecrement();

        return () => {
            clearInterval(counter);
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
        removeFromFlowsheetBackend(entries.filter(item => item.id === id)[0].entry_id);

        edited.current = true;
        maxEditDepth.current = Math.max(entries.findIndex((item) => item.id === id), maxEditDepth.current) + 1;

        index(newEntries);
        setEntries(newEntries);
    }

    const clearQueue = () => {
        setQueue([]);
        localStorage.setItem("queue", JSON.stringify([]));
    }

    const updateQueueEntry = (id, label, value) => {
        let newQueue = [...queue];
        newQueue[id][label] = value;
        setQueue(newQueue);
        localStorage.setItem("queue", JSON.stringify(newQueue));
    }

    const updateEntry = (id, label, value) => {
        let newEntries = [...entries];
        updateFlowsheetEntryOnBackend(newEntries[id].entry_id, label, value);
        newEntries[id][label] = value;
        setEntries(newEntries);
    }

    const [backendCaller, setBackendCaller] = useState(null);
    const updateWithBackend = () => {
        console.log(`updating from backend i${edited.current ? 's' : 's not'} necessary`);
        if (edited.current) {
            (async () => {

                const { data, error } = await getFlowsheetFromBackend({ page: 0, limit: maxEditDepth.current });

                if (error) {
                    toast.error("Error updating flowsheet");
                    edited.current = false;
                    updateEntriesFromBackend([{
                        message: "The flowsheet is out of sync with the backend. Make sure you are connected to the internet and contact a site admin.",
                        title: "",
                        album: "",
                        artist: "",
                        label: "",
                        entry_id: -1
                    }]);
                    return;
                }

                console.log(data);

                if (data) {
                    updateEntriesFromBackend(data);
                }
                edited.current = false;
                maxEditDepth.current = 0;

            })();
        }
    }

    const updateEntriesFromBackend = (data) => {

        let newEntries = data.map((item) => (
            (item?.message?.length) > 0 ? 
            {
                message: item.message,
                title: "",
                album: "",
                artist: "",
                label: "",
                entry_id: item.id
            } : {
                message: "",
                title: item.track_title,
                album: item.album_title,
                artist: item.artist_name,
                label: item.record_label,
                entry_id: item.id
            }));

        let newEntriesPlusOldEntries = [...newEntries, ...(entries.slice(maxEditDepth.current, maxEditDepth.current - newEntries.length))];

        index(newEntries);
        setEntries(newEntries);
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
        console.table(set);
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

        updateWithBackend();
        setBackendCaller(setInterval(updateWithBackend, 60000)); // kicks off auto-update
        localStorage.getItem("queue") && setQueue(JSON.parse(localStorage.getItem("queue")));

        setAutoPlay(false);

        return () => {
            if (backendCaller) clearInterval(backendCaller);
        }
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
                updateWithBackend
            }}
        >
            {children}
        </FlowsheetContext.Provider>
    );
}