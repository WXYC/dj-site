import { Typography } from "@mui/joy"
import { useEffect, useRef, useState } from "react";



export const ScrollOnHoverText = (props) => {

    const [hovering, setHovering] = useState(false);
    const [canHover, setCanHover] = useState(true);

    const textRef = useRef(null);

    useEffect(() => {
        if (!textRef.current) return;

        if ((textRef.current.scrollWidth - textRef.current.clientWidth) < 3) {
            setCanHover(false);
        }

    }, [textRef.current]);

    return (
        <Typography
            ref={textRef}
            {...props}
            onMouseEnter={() => setHovering(canHover)}
            onMouseLeave={() => setHovering(false)}
            sx = {{
                ...props.sx,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}
        >
            {hovering ? (
                <marquee>
                    {props.children}
                </marquee>
            ) : (
                props.children
            )}
        </Typography>
    )
}