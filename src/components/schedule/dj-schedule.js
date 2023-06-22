import React, { createContext, useState } from "react";
import CalendarWidget from "../../widgets/dj-schedule/calendar";

export const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const hours = Array.from(Array(24).keys()).map((hour) => {
    if (hour == 0) {
        return {
            number: '12',
            ampm: 'am',
        };
    } else if (hour < 12) {
        return {
            number: hour,
            ampm: 'am',
        };
    } else if (hour == 12) {
        return {
            number: '12',
            ampm: 'pm',
        }
    } else {
        return {
            number: `${(hour - 12)}`,
            ampm: 'pm',
        }
    }
});

const exampleItems = {
    'Sunday-1-am': {
        type: 'DJ Show',
        name: '',
        DJ: 'Turncoat',
        lengthInHours: 2,
    },
    'Tuesday-4-am': {
        type: 'DJ Show',
        name: '',
        DJ: 'Turncoat',
        lengthInHours: 0.25,
    },
    'Monday-5-am': {
        type: 'New DJ Show',
        name: '',
        DJ: '',
        lengthInHours: 0.5,
    },
    'Wednesday-6-am': {
        type: 'Specialty Show',
        name: 'Sunset Sountrack',
        DJ: '',
        lengthInHours: 0.75,
    },
    'Thursday-7-am': {
        type: 'DJ Show',
        name: '',
        DJ: '',
        lengthInHours: 1,
    },
    'Friday-8-am': {
        type: 'DJ Show',
        name: 'Dark Sounds',
        DJ: 'Turncoat',
        lengthInHours: 3.75,
    },
    'Saturday-9-am': {
        type: 'Specialty Show',
        name: 'Orange County Special',
        DJ: '',
        lengthInHours: 4.5,
    },
    
};

export const CalendarThemeContext = createContext();

export const CalendarThemeProvider = ({ children }) => {
    const [colorScheme, setColorScheme] = useState('Type');
    const [open, setOpen] = useState(false);

    return (
        <CalendarThemeContext.Provider value={{ colorScheme, setColorScheme, open, setOpen }}>
            {children}
        </CalendarThemeContext.Provider>
    );
};

const DJSchedule = () => {

    return (
        <CalendarThemeProvider>
            <CalendarWidget items={exampleItems} />
        </CalendarThemeProvider>
    )
}

export default DJSchedule;