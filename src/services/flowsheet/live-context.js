import { createContext, useContext, useEffect, useState } from "react";
import { getOnAirFromBackend, joinBackend, leaveBackend } from "./flowsheet-service";
import { toast } from "sonner";


export const LiveContext = createContext();

export const useLive = () => useContext(LiveContext);

export const LiveProvider = ({ children }) => {
    
        const [live, setLive] = useState(false);
        const [intermediate, setIntermediate] = useState(false);

        useEffect(() => {
            updateLiveValue();
        }, []);

        const updateLiveValue = async () => {
            if (intermediate) return; // protections against double-clicking
            setIntermediate(true);
            const { data, error } = await getOnAirFromBackend();

            if (error) {
                console.error(error);
                return;
            }
            
            console.log("Getting on air from backend");
            console.log(data);

            setLive(data);
            setIntermediate(false);
        };

        const goLive = async () => {
            const { data, error } = await joinBackend();
            updateLiveValue();

            if (error) {
                toast.error(error.message);
                return;
            }

            return data;
        };

        const goOff = async () => {
            const { data, error } = await leaveBackend();
            updateLiveValue();

            if (error) {
                toast.error(error.message);
                return;
            }

            return data;
        };
    
        return (
            <LiveContext.Provider value={{ live, goLive, goOff, intermediate }}>
                {children}
            </LiveContext.Provider>
        )
    }