import React, { createContext, useContext, useEffect, useState } from "react";


/**
 * Represents the DJ schedule-setting calendar component.
 * @component
 * @category Schedule
 *
 * @returns {JSX.Element} The DJSchedule component.
 */
const DJSchedule = () => {

    const [events, setEvents] = useState({});
/* 
    useEffect(() => {
        (async () => {
            const data = await getSchedule();

            setEvents(data);

        })();
    }, []); */

    return (
        <Calendar items={events} />
    )
}

export default DJSchedule;