import { toast } from "sonner";
import { getter, setter } from "../api-service";
import { getDJInfo } from "../dj/dj-service";

const dayStrings = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getScheduleFromBackend = () => getter('schedule')();

export const getSchedule = async () => {
  const { data, error } = await getScheduleFromBackend();

  if (error) {
    toast.error("Could not retrieve schedule");
    console.error(error);
    return;
  }

  const formattedSchedule = await Promise.all(data.map(formatEvent));

  return Object.fromEntries(formattedSchedule);
};

export const addToSchedule = (new_event) => setter('schedule')(new_event);

const formatEvent = async (event) => {
    const { id, day, start_time, show_duration, specialty_id, assigned_dj_id, assigned_dj_id2 } = event;

    const { data: firstDJ, error: firstDJError } = await getDJInfo(assigned_dj_id);
    const { data: secondDJ, error: secondDJError } = await getDJInfo(assigned_dj_id2);

    let event_code = `${dayStrings[day]}-${extractTo12Hour(start_time)}`;
    let duration_15_min_blocs = show_duration / 4;

    let destructuredEvent = {
        type: specialty_id ? 'Specialty Show' : 'DJ Show',
        DJ1: firstDJ?.dj_name ?? '',
        DJ2: secondDJ?.dj_name ?? '',
        lengthInHours: duration_15_min_blocs,
    };

    return [event_code, destructuredEvent];
};

const extractTo12Hour = (time) => {
    let hour = parseInt(time.split(':')[0]);
    let ampm = 'am';

    if (hour == 0) {
        hour = 12;
    } else if (hour > 12) {
        hour -= 12;
        ampm = 'pm';
    }

    return `${hour}-${ampm}`;
};

export const toDbTime = (hourAmPm, minutes) => {
    // input: 12 hour time, { hour, ampm }, minutes
    // output 24 hour time, 00:00:00
    let hour = hourAmPm['number'];
    let ampm = hourAmPm['ampm'];
    if (ampm == 'pm') {
        hour = Number(hour) + 12;
    }
    if (minutes > 45) {
        minutes = 0;
        hour = Math.min(hour + minutes / 60, 24);
    }
    let hourString = hour.toString();
    if (hourString.length == 1) {
        hourString = '0' + hourString;
    }
    let minuteString = minutes.toString();
    if (minuteString.length == 1) {
        minuteString = '0' + minuteString;
    }
    return `${hourString}:${minuteString}:00`;
    
};