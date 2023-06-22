import { createContext, useContext, useState } from "react";


export const LiveContext = createContext();

export const useLive = () => useContext(LiveContext);

export const LiveProvider = ({ children }) => {
    
        const [live, setLive] = useState(false);
    
        return (
            <LiveContext.Provider value={{ live, setLive }}>
                {children}
            </LiveContext.Provider>
        )
    }