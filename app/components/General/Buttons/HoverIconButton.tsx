'use client';
import { Box, ColorPaletteProp, IconButton, IconButtonProps, Tooltip } from "@mui/joy";
import React from "react";
import { useState } from "react";

interface HoverIconButtonProps extends IconButtonProps {
    icon: JSX.Element;
    hoverIcon: JSX.Element;
    hoverColor?: ColorPaletteProp;
}

const HoverIconButton = (props: HoverIconButtonProps): JSX.Element => {

    const [hover, setHover] = useState<Boolean>(false);

    const handleMouseEnter = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setHover(true);
        if (props.onMouseEnter) {
            props.onMouseEnter(event);
        }
    };

    const handleMouseLeave = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setHover(false);
        if (props.onMouseLeave) {
            props.onMouseLeave(event);
        }
    };

    return (
        <IconButton {...props}
            color={hover ? props.hoverColor : props.color}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {hover ? props.hoverIcon : props.icon}
        </IconButton>
    );
};

export default HoverIconButton;