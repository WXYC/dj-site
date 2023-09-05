import Close from '@mui/icons-material/Close';
import { AspectRatio, Box, Button, Select, Sheet, Stack, Tooltip, Typography, Option, Autocomplete, IconButton } from "@mui/joy";
import React, { useEffect, useRef, useState } from "react";
import { addToSchedule, getSchedule, toDbTime } from "../../../services/schedule/schedule-service";
import useMousePosition from "../../../widgets/MousePosition";
import EventWidget from "../../../widgets/dj-schedule/Event";
import AlbumIcon from '@mui/icons-material/Album';
import PeopleIcon from '@mui/icons-material/People';
import StarsIcon from '@mui/icons-material/Stars';
import { days, hours } from "../../schedule/dj-schedule";
import { toast } from 'sonner';

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
const StationSchedule = (props) => {

    const boolToDifferentiateClickFromDrag = useRef(false);

    const [events, setEvents] = useState({});

    const [roster, setRoster] = useState([]);
    const [djsSelected, setDJsSelected] = useState([]);

    const [edited, setEdited] = useState(true);

    useEffect(() => {
        if (!edited) return;
        (async () => {
            const data = await getSchedule();

            setEvents(data);
            setEdited(false);

        })();
    }, [edited]);

    useEffect(() => {
        
        setRoster(props.roster.map((dj) => (`${dj.djName} (${dj.name})`)));

    }, [props.roster]);

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

    const closeForm = () => {
        setFormOpen(false);
        setDragging(false);
        setDaySelected('');
        setStartHourSelected(0);
    };

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

    const saveEvent = async () => {
        
        let new_event = {
            day: days.indexOf(daySelected),
            start_time: toDbTime(startHourSelected, startMinuteSelected),
            show_duration: (-Number(extent) * 4),
            specialty_id: null,
            assigned_dj_id: 1,
            assigned_dj_id2: null,
        };

        console.log(new_event);

        const { data, error } = await addToSchedule(new_event);

        if (error) {
            toast.error("Could not add event");
            console.error(error);
            return;
        }

        console.log(data);
        setEdited(true);

        closeForm();
    };
            

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
                            <Box>
                                <AspectRatio 
                                    variant="solid"
                                    ratio={10} 
                                    color={eventColors[eventType]}
                                    sx = {{
                                        borderTopRightRadius: '4px',
                                        borderTopLeftRadius: '4px',
                                    }}
                                >
                                </AspectRatio>
                                <Box
                                    sx = {{
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        left: 5,
                                        display: 'flex',
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Typography level="body3" variant='solid' sx = {{ background: 'transparent !important' }}>
                                        {day}s from {hour['number'] + hour['ampm']} to {hour['number'] + hour['ampm']}
                                    </Typography>
                                    <IconButton
                                        variant="solid"
                                        size="sm"
                                        sx = {{
                                            background: 'transparent',
                                            '&:hover' : {
                                                background: 'transparent',
                                                transform: 'scale(1.1)',
                                            }
                                        }}
                                        onClick={closeForm}
                                    >
                                        <Close />
                                    </IconButton>
                                </Box>
                                <Box
                                    sx = {{
                                        p: 1,
                                        minWidth: '300px'
                                    }}
                                >
                                    <table>
                                        <tbody>
                                            <tr>
                                                <td style={{ minWidth: '2rem' }}>
                                                    <Box sx = {{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '100%',
                                                        height: '100%',
                                                    }}>
                                                        <AlbumIcon
                                                            color="neutral"
                                                            fontSize='xl'
                                                            sx = {{
                                                                my: 'auto',
                                                            }}
                                                        />
                                                    </Box>
                                                </td>
                                                <td style={{ width: '100%' }}>
                                                    <Select
                                                        required 
                                                        color={eventColors[eventType]}
                                                        variant="solid"
                                                        placeholder="Select Type"
                                                        defaultValue={eventType}
                                                        sx = {{
                                                            width: '100%',
                                                        }}
                                                        onChange={(e, newValue) => setEventType(newValue)}
                                                    >
                                                        <Option value="dj-shift">DJ Shift</Option>
                                                        <Option value="specialty-show">Specialty Show</Option>
                                                        <Option value="new-dj-shift">New DJ Shift</Option>
                                                    </Select>
                                                </td>
                                            </tr>
                                            {(eventType == 'specialty-show') && (<tr>
                                                <td>
                                                    <Box sx = {{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '100%',
                                                        height: '100%',
                                                    }}>
                                                        <StarsIcon
                                                            color="neutral"
                                                            fontSize='xl'
                                                            sx = {{
                                                                my: 'auto',
                                                            }}
                                                        />
                                                    </Box>
                                                </td>
                                                <td>
                                                    <Autocomplete
                                                        required={eventType == 'specialty-show'}
                                                        multiple 
                                                        options={[]}
                                                        placeholder="Select Specialty Show"
                                                        sx = {{
                                                            width: '100%',
                                                        }}
                                                    />
                                                </td>
                                            </tr>)}
                                            <tr>
                                                <td>
                                                    <Box sx = {{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '100%',
                                                        height: '100%',
                                                    }}>
                                                        <PeopleIcon
                                                            required
                                                            color="neutral"
                                                            fontSize='xl'
                                                            sx = {{
                                                                my: 'auto',
                                                            }}
                                                        />
                                                    </Box>
                                                </td>
                                                <td>
                                                    <Autocomplete
                                                        multiple 
                                                        options={roster}
                                                        placeholder="Select DJs (Type to Search)"
                                                        sx = {{
                                                            width: '100%',
                                                            maxWidth: '300px'
                                                        }}
                                                        onChange={(e, newValue) => setDJsSelected(newValue)}
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <Box
                                        sx = {{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end',
                                            width: '100%',
                                            py: 1,
                                        }}
                                    >
                                        <Button
                                            color={eventColors[eventType]}
                                            size="sm"
                                            onClick={saveEvent}
                                        >
                                            Save
                                        </Button>
                                    </Box>
                                </Box>
                            </Box>
                        }
                        open = {formOpen}
                        placement="right"
                        onMouseDown = {(e) => e.stopPropagation()}
                        sx = {{
                            pointerEvents: 'all',
                            p: 0
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
                            transition: 'bottom 0.1s ease-in-out'
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
                {events[`${day}-${hour['number']}-${hour['ampm']}`] && (
                    <EventWidget
                        {...events[`${day}-${hour['number']}-${hour['ampm']}`]}
                    />
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