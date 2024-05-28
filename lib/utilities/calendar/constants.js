
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const HOURS = Array.from(Array(24).keys()).map((hour) => {
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

export const EXAMPLE_ITEMS = {
    'Sunday-1-am': {
        type: 'DJ Show',
        DJ2: '',
        DJ1: 'Turncoat',
        lengthInHours: 2,
    },
    'Tuesday-4-am': {
        type: 'DJ Show',
        DJ2: '',
        DJ1: 'Turncoat',
        lengthInHours: 0.25,
    },
    'Monday-5-am': {
        type: 'New DJ Show',
        DJ2: '',
        DJ1: '',
        lengthInHours: 0.5,
    },
    'Wednesday-6-am': {
        type: 'Specialty Show',
        DJ2: 'Sunset Sountrack',
        DJ1: '',
        lengthInHours: 0.75,
    },
    'Thursday-7-am': {
        type: 'DJ Show',
        DJ2: '',
        DJ1: '',
        lengthInHours: 1,
    },
    'Friday-8-am': {
        type: 'DJ Show',
        DJ2: 'Dark Sounds',
        DJ1: 'Turncoat',
        lengthInHours: 3.75,
    },
    'Saturday-9-am': {
        type: 'Specialty Show',
        DJ2: 'Orange County Special',
        DJ1: '',
        lengthInHours: 4.5,
    },
    
};