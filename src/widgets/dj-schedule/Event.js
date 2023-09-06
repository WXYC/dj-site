import { Badge, Box, Sheet, Typography } from "@mui/joy";
import React, { useContext, useEffect, useState } from "react";
import { useAuth } from "../../services/authentication/authentication-context";
import { CalendarThemeContext } from "../../components/schedule/dj-schedule";
import { ClickAwayListener } from "@mui/material";

const EventColors = {
    "Type" : {
        'DJ Show': 'primary',
        'New DJ Show': 'info',
        'Specialty Show': 'success',
    },
    "Relevance" : {
        'mine': 'primary',
        'not': 'neutral',
    }
};

const EventWidget = (props) => {

    const { user } = useAuth();
    const { colorScheme, open, setOpen } = props.themeData ?? { colorScheme: 'Type', open: false, setOpen: null};
    const [colorChoice, setColorChoice] = useState(null);

    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            setIsOpen(false);
        }
    }, [isOpen, open, setOpen]);

    useEffect(() => {
        switch (colorScheme ?? 'Type') {
            case 'Type':
                setColorChoice(EventColors.Type[props.type]);
                break;
            case 'Relevance':
                setColorChoice(EventColors.Relevance[
                    (props.DJ1 == user?.djName || props.DJ2 == user?.djName) ? 'mine' : 'not'
                ]);
                break;
            default:
                setColorChoice(null);
                break;
        }
    }, [props.type, props.DJ1, props.DJ2, user.djName, colorScheme]);

    return (
        <ClickAwayListener
            onClickAway={() => { 
                if (isOpen) {
                    setIsOpen(false);
                    setOpen(false);
                }
            }}
        >
        <Sheet
            variant = {isOpen ? 'solid' : (open ? 'soft' : 'solid')}
            color={colorChoice ?? 'primary'}
            style = {{
                position: 'absolute',
                zIndex: 1,
                top: 0,
                left: 0,
                right: 0,
                bottom: `${((1 - props.lengthInHours) * 40)}px`,
                borderRadius: '0.5rem',
                transition: 'all 0.1s ease-in-out',
                cursor: isOpen ? 'pointer' : (open ? 'default' : 'pointer'),
                pointerEvents: setOpen ? 'auto' : 'none',
            }}
            onClick = {() => {
                setIsOpen(!isOpen);
                setOpen(!open);
            }}
        >
            <Badge
                size="sm"
                color="warning"
                invisible={((props.DJ1?.length + props.DJ2?.length) > 0 ? true : false)}
                sx = {{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                }}
            >
            </Badge>
            {(props.lengthInHours > 1.5) && (<Typography
                level="body3"
                sx = {{
                    textTransform: 'uppercase',
                    textAlign: 'left',
                    userSelect: 'none',
                    ml: 1,
                    mt: 1,
                    mb: 0,
                }}
            >
                {props.type}
            </Typography>)}
            <Typography
                level="body5"
                sx = {{
                    textTransform: 'uppercase',
                    textAlign: 'left',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    ml: (props.lengthInHours > 0.5) ? 1 : 0.75,
                    mt: (props.lengthInHours > 1.5) ? 0 : (props.lengthInHours >= 1) ? 0.5 : (props.lengthInHours > 0.5) ? 0 : (props.lengthInHours > 0.25) ? 0.35 : -0.25,
                }}
            >
                1 AM - 2 AM {props.lengthInHours > 0.5 ? '' : `• DJ ${((props.DJ1?.length + props.DJ2?.length) > 0 ? props.DJ1 : null) ?? 'TBD'}` }
            </Typography>
            {(props.lengthInHours >= 1.75 && props.type != "Specialty Show" && props.DJ2) && (<Typography
                level="body1"
                sx = {{
                    mx: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1rem',
                    whiteSpace: (props.lengthInHours > 2) ? 'normal' : 'nowrap',
                }}
            >
                {props.DJ2}
            </Typography>)}
            {(props.lengthInHours >= 2.5 && props.type != "Specialty Show" && props.DJ2) && (<Typography
                level="body4"
                sx = {{
                    textTransform: 'uppercase',
                    textAlign: 'left',
                    userSelect: 'none',
                    mx: 1,
                    mt: 0.5,
                    mb: 0,
                }}
            >
                with
            </Typography>)}
            {(props.lengthInHours >= 0.75) && (<Typography
                level="body1"
                sx = {{
                    ml: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1rem',
                    whiteSpace: (props.lengthInHours > 2) ? 'normal' : 'nowrap',
                }}
            >
                {(props.type == "Specialty Show" && (props.DJ2?.length > 0)) ? props.DJ2 : `DJ ${(props.DJ1?.length > 0 ? props.DJ1 : null) ?? 'TO BE DECIDED'}`}
            </Typography>)}
            {(props.lengthInHours >= 1.5 && props.type == "Specialty Show") && (<Typography
                level="body4"
                sx = {{
                    textTransform: 'uppercase',
                    textAlign: 'left',
                    userSelect: 'none',
                    ml: 1,
                    mt: 0.5,
                    mb: 0,
                }}
            >
                with
            </Typography>)}
            {(props.lengthInHours >= 1.5 && props.type == "Specialty Show") && (<Typography
                level="body1"
                sx = {{
                    ml: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1rem',
                    whiteSpace: (props.lengthInHours > 2) ? 'normal' : 'nowrap',
                }}
            >
                {`DJ ${(props.DJ1?.length > 0 ? props.DJ1 : null) ?? 'TO BE DECIDED'}`}
            </Typography>)}
        </Sheet>
        </ClickAwayListener>
    )
}

export default EventWidget;