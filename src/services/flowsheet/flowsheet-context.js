import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";
import { getSongInfoFromLastFM } from "../artwork/last-fm-image";
import { toast } from "sonner";
import { addSongToBackend, getFlowsheetFromBackend, joinBackend, leaveBackend, sendMessageToBackend } from "./flowsheet-service";

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
        updateFlowsheet(entry);
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

    const [backendCaller, setBackendCaller] = useState(null);
    const updateWithBackend = () => {
        console.log(`updating from backend i${edited.current ? 's' : 's not'} necessary`);
        setBackendCaller(setTimeout(updateWithBackend, 60000)); // Update every 1 minute
        if (edited.current) {
            (async () => {

                const { data, error } = await getFlowsheetFromBackend();

                if (error) {
                    toast.error("Error updating flowsheet");
                    edited.current = false;
                    return;
                }

                console.log(data);

                if (data) {
                    toast.success("Flowsheet updated");
                    updateEntriesFromBackend(data);
                }
                edited.current = false;

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
                label: ""
            } : {
                message: "",
                title: item.track_title,
                album: item.album_title,
                artist: item.artist_name,
                label: item.record_label
            }));

        index(newEntries);
        setEntries(newEntries);
    }

    const updateFlowsheet = async (entry = null) => {

        if (entry) {

            const { data, error} = await (async (entry) => {
                if (entry.message == "") {
                    addSongToBackend(entry);
                } else {
                    if (entry.message.includes("joined")) {
                        return joinBackend().then((data) => {
                            sessionStorage.setItem("showId", data.data.id);
                            return { data: data.data, error: null };
                        }).catch((error) => {
                            return { data: null, error: error.error };
                        });
                    } else if (entry.message.includes("left")) {
                        return leaveBackend();
                    } else {
                        return sendMessageToBackend(entry.message);
                    }
                }
            })(entry);

            if (error) {
                toast.error("Flowsheet is out of sync with backend. Make sure you are connected to the internet and contact a site admin.");
                console.log(error);
                return;
            }

            if (data) {
                console.log(data);
            }
            
        }

        // important: mark flowsheet for backend sync
        edited.current = true;
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

        updateWithBackend(); // kicks off auto-update
        localStorage.getItem("queue") && setQueue(JSON.parse(localStorage.getItem("queue")));

        setAutoPlay(false);

        return () => {
            if (backendCaller) clearTimeout(backendCaller);
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