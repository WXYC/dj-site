import { Box, Sheet, Stack, Switch, Typography } from "@mui/joy";
import React, { useContext } from "react";
import EventWidget from "./Event";

import { CalendarThemeContext, days, hours } from "../../components/schedule/dj-schedule";

const CalendarWidget = (props) => {

    const { colorScheme, setColorScheme, open, setOpen } = useContext(CalendarThemeContext);

    return (
    <Sheet
    variant="outlined"
    sx = {{
        borderRadius: 'lg',
        width: '100%',
        height: '100%',
        position: 'relative',
    }}
>
    <Box
        sx = {{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: 1
        }}
    >
        <Typography
            level="body3"
        >
            Highlight My Shows
        </Typography>
        <Switch
            size="sm"
            checked={colorScheme === 'Relevance'}
            onChange={(event) => {
                setColorScheme(event.target.checked ? 'Relevance' : 'Type');
            }}
            sx = {{
                mx: 1,
            }}
        />
    </Box>
<Stack 
    id = 'draggable-calendar'
    direction="row"
    sx = {{
        p: 2,
        overflow: 'auto',
        position: 'absolute',
        top: '40px',
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 'lg',
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
            height: '40px',
            minHeight: '40px',
            position: 'relative',
        }}
    >
        {props.items[`${day}-${hour['number']}-${hour['ampm']}`] && (
            <EventWidget 
                {...props.items[`${day}-${hour['number']}-${hour['ampm']}`]}
            />
        )}
    </Sheet>   
))}   
</Stack>
))}
</Stack>
</Sheet>
    )
}

export default CalendarWidget;