'use client';

/* Components */
import { Nav } from "./components/Nav";

/* Instruments */
import { getClassicView, useSelector } from "@/lib/redux";
import { Toaster } from "sonner";
import { GlobalPopups } from "./components/General/Popups/Popups";
import ThemeRegistry from "./styles/ThemeRegistry";
import "./styles/globals.css";

export interface PropsWithClassicView extends React.PropsWithChildren {
    classicChildren: React.ReactNode;
}

const VersionSelector = (props: PropsWithClassicView) => {

    const classicView = useSelector(getClassicView);
  
    if (classicView) return props.classicChildren;
  
    return props.children;
  
}

export default VersionSelector;