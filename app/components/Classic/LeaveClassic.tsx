'use client';
import { applicationSlice, getClassicView, useDispatch, useSelector } from "@/lib/redux";
import { useColorScheme } from "@mui/joy";
import { useEffect } from "react";

export default function LeaveClassic() {
    const dispatch = useDispatch();

    const classicView = useSelector(getClassicView);

    const switchToUpdatedInterface = (e: any) => {
        dispatch(applicationSlice.actions.setClassicView(false));
        setMode(sessionStorage.getItem("modeSavedFromClassic") == "dark" ? "dark" : "light");
    }

    const { mode, setMode } = useColorScheme();

    useEffect(() => {
        document.querySelector('html')?.setAttribute('data-classic-view', classicView ? 'true' : 'false');
    }, [classicView]);

    return (
        <a onClick={switchToUpdatedInterface} href="#" >
            Switch to Updated Interface
        </a>
    )
}