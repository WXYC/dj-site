export function getClosestHour() {
    const now = new Date();
    const minutes = now.getMinutes();
    now.setMinutes(0, 0, 0);

    if (minutes > 30) {
      now.setHours(now.getHours() + 1);
    }

    console.log("Closest hour:", now);

    return now;
}

export function parseTimeStringToDate(timeString: string): Date {
    const now = new Date();
    const [hour, minute] = timeString.split(":").map(Number);
  
    now.setHours(hour);
    now.setMinutes(minute);
    now.setSeconds(0);
    now.setMilliseconds(0);
  
    return now;
  }
  