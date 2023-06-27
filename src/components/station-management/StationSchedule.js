import { Autocomplete, Box, FormControl, Sheet, Stack, Tab, TabList, TabPanel, Tabs, Tooltip, Typography } from "@mui/joy";
import React, { useEffect, useRef, useState } from "react";
import useMousePosition from "./station-schedule/MousePosition";
import simulateAbsolutePositioning from "./station-schedule/SimulateAbsolutePositioning";
import Chip from '@mui/joy/Chip';
import Close from '@mui/icons-material/Close';
import { days, hours } from "../schedule/dj-schedule";

// Top 100 films as rated by IMDb users. http://www.imdb.com/chart/top
const top100Films = [
    { title: 'The Shawshank Redemption', year: 1994 },
    { title: 'The Godfather', year: 1972 },
    { title: 'The Godfather: Part II', year: 1974 },
    { title: 'The Dark Knight', year: 2008 },
    { title: '12 Angry Men', year: 1957 },
    { title: "Schindler's List", year: 1993 },
    { title: 'Pulp Fiction', year: 1994 },
    {
      title: 'The Lord of the Rings: The Return of the King',
      year: 2003,
    },
    { title: 'The Good, the Bad and the Ugly', year: 1966 },
    { title: 'Fight Club', year: 1999 },
    {
      title: 'The Lord of the Rings: The Fellowship of the Ring',
      year: 2001,
    },
    {
      title: 'Star Wars: Episode V - The Empire Strikes Back',
      year: 1980,
    },
];

const eventColors = {
    'dj-shift': 'primary',
    'specialty-show': 'success',
    'new-dj-shift' : 'info',
};

const eventTypes = {
    'dj-shift': 'DJ Shift',
    'specialty-show': 'Specialty Show',
    'new-dj-shift' : 'New DJ Shift',
};

/**
 * Renders a schedule interface with draggable and resizable events, similar to Google Calendar functionality.
 * 
 * @component
 * @category Station Management
 *
 * @returns {JSX.Element} The rendered component.
 */
const StationSchedule = () => {

    const boolToDifferentiateClickFromDrag = useRef(false);

    const [daySelected, setDaySelected] = useState('');
    const [startHourSelected, setStartHourSelected] = useState(0);
    const [startMinuteSelected, setStartMinuteSelected] = useState(0);
    const [extent, setExtent] = useState(0);
    const [dragging, setDragging] = useState(false);
    const mousePosition = useMousePosition(); 

    const [yDiff, setYDiff] = useState(0);
    const [mouseLock, setMouseLock] = useState(false);
    const [yToMouse, setYToMouse] = useState(0);

    const [formOpen, setFormOpen] = useState(false);

    const [eventType, setEventType] = useState('dj-shift');

    const [hourHeight, setHourHeight] = useState(-1);

    const handleHourDown = (e, day, hour) => {
        boolToDifferentiateClickFromDrag.current = true;
        let mousePositionAtClick = mousePosition.y;
        setDaySelected('');
        setStartHourSelected(0);

        setTimeout(() => {
            if (boolToDifferentiateClickFromDrag.current) {
                setFormOpen(false);
                setDragging(true);
                setDaySelected(day);
                setStartHourSelected(hour);
                
                // round to the nearest division of 4 in the target bounding rect
                let rect = e.target.getBoundingClientRect();
                let pixelHeight = rect.height;
                setHourHeight(pixelHeight);
                let minuteHeight = pixelHeight / 60; // Assuming 60 minutes per hour
                let y = e.clientY - rect.top;
                let roundedMinutes = Math.round(y / minuteHeight / 15) * 15;
                let roundedValue = Math.round(roundedMinutes / 60 * pixelHeight);

                setStartMinuteSelected(roundedMinutes);

                setYDiff(roundedValue);
                setMouseLock(mousePositionAtClick);
                setYToMouse(yDiff);
            }
        }, 100);
    }

    const handleHourUp = (e) => {
        boolToDifferentiateClickFromDrag.current = false;
        setDragging(false);
        setFormOpen(true);
    }

    useEffect(() => {
        if (dragging) {
            document.getSelection().removeAllRanges();
            let span = mouseLock - mousePosition.y;
            let spanInHours = (Math.round((span / hourHeight) * 4) / 4).toFixed(2);
            setExtent(spanInHours);
            let spanInPixels = spanInHours * hourHeight;
            setYToMouse(spanInPixels);
        }
    }, [mousePosition, dragging, hourHeight]);

    useEffect(() => {
    }, [yToMouse]);
            

    return (
        <>
        <Stack 
            id = 'draggable-calendar'
            direction="row"
            sx = {{
                p: 2,
                overflow: 'auto',
                position: 'absolute',
                top: '45.2px',
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 'lg',
                cursor: (dragging ? 'row-resize' : 'crosshair'),
              }}
              spacing = {'-1px'}
        >
        <Stack
            direction="column"
            sx = {{
                width: '1.5rem',
                minWidth: '1.5rem',
            }}
            spacing={'-1px'}
        >
        <Sheet
            variant='soft'
            sx = {(theme) => ({
                borderTopLeftRadius: theme.vars.radius.md,
            })}
        >
            <span style={{visibility: 'hidden'}}>0</span>
        </Sheet>
        {hours.map((hour) => (
            <Sheet
                variant='soft'
                sx = {{
                    minHeight: '2.5rem',
                    textAlign: 'center',
                    writingMode: 'sideways-lr',
                    display: 'flex',
                }}
            >
                <Typography
                    level="body4"
                    sx = {{
                        textAlign: 'center',
                        ml: 'auto',
                        my: 'auto',
                    }}
                >
                    {hour['number'] + hour['ampm']}
                </Typography>
            </Sheet>
        ))}
        </Stack>
        {days.map((day, i) => (
        <Stack
            direction="column"
            sx = {{
                width: '100%',
                minWidth: '100px',
            }}
            spacing={'-1px'}
        >
        <Sheet
            variant='soft'
            sx = {(theme) => ({
                borderTopRightRadius: (i == days.length - 1) ? theme.vars.radius.md : 0,
            })}
        >
            <Typography
                level="body2"
                sx = {{
                    textAlign: 'center',
                }}
            >
                {day}
            </Typography>
        </Sheet>
         {hours.map((hour) => (
            <Sheet
                id = {`${day}-${hour['number']}-${hour['ampm']}`}
                variant='outlined'
                sx = {{
                    width: '100%',
                    minHeight: '2.5rem',
                    position: 'relative',
                }}
                onMouseDown = {(e) => handleHourDown(e, day, hour)}
                onMouseUp = {handleHourUp}
            >
                {(daySelected == day && startHourSelected == hour) && (
                    <Tooltip
                        variant = 'outlined'
                        title = {
                            <Box 
                                sx = {{
                                    p: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                }}
                            >
                                <Tabs
                                    defaultValue={'dj-shift'}
                                    value={eventType}
                                    onChange={(e, value) => setEventType(value)}
                                >
                                    
                                    <TabPanel value={'dj-shift'}>
                                        <form>
                                            <FormControl required>
                                                <Typography level="body2">Pick DJs</Typography>
                                                
                                            </FormControl>
                                            <FormControl required>
                                                <Autocomplete>

                                                </Autocomplete>
                                            </FormControl>
                                        </form>
                                    </TabPanel> 
                                    <TabList   
                                    variant='soft'                                 
                                        sx = {{
                                            mt: 2,
                                        }}
                                    >
                                        <Tab value={'dj-shift'}>DJ Shift</Tab>
                                        <Tab value={'new-dj-shift'}>New DJ Shift</Tab>
                                        <Tab value={'specialty-show'}>Specialty Show</Tab>
                                    </TabList>
                                </Tabs>   
                            </Box>
                        }
                        open = {formOpen}
                        placement="right"
                        onMouseDown = {(e) => e.stopPropagation()}
                        sx = {{
                            pointerEvents: 'all',
                        }}
                    >
                    <Sheet 
                        id = "preview" 
                        variant = 'outlined'
                        color={eventColors[eventType]}
                        style = {{
                            position: 'absolute',
                            zIndex: 1,
                            top: yDiff,
                            left: 0,
                            right: 0,
                            bottom: yToMouse,
                            borderRadius: '0.5rem',
                            transition: 'bottom 0.05s ease-in-out'
                        }}
                    >
                        <Typography
                            level="body3"
                            sx = {{
                                textTransform: 'uppercase',
                                textAlign: 'left',
                                userSelect: 'none',
                                ml: 2,
                                mt: 1,
                            }}
                        >
                            {eventTypes[eventType]}
                        </Typography>
                    </Sheet>
                    </Tooltip>
                )}
            </Sheet>   
        ))}   
        </Stack>
        ))}
        </Stack>
        </>
    )
}

export default StationSchedule;