"use client";

import { Box, Typography, TypographyProps } from "@mui/joy";
import { useCallback, useEffect, useState } from "react";
import Marquee from "react-fast-marquee";

export default function ScrollOnHoverText({
  children,
  sx,
  width,
  ...props
}: TypographyProps) {
  const [hovering, setHovering] = useState(false);
  const [canHover, setCanHover] = useState(false);

  const [boxSize, setBoxSize] = useState(0);
  const boxRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setBoxSize(node.clientWidth);
    }
  }, []);

  const [textSize, setTextSize] = useState(0);
  const textRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setTextSize(node.clientWidth);
    }
  }, []);

  useEffect(() => {
    if (boxSize > 0 && textSize > 0) {
      setCanHover(textSize > boxSize);
    }
  }, [boxSize, textSize]);

  return (
    <Box
      ref={boxRef}
      onMouseEnter={() => setHovering(canHover)}
      onMouseLeave={() => setHovering(false)}
      sx={{
        width: width ?? 100,
      }}
    >
      <Marquee play={hovering}>
        <Typography
          ref={textRef}
          {...props}
          sx={{
            ...sx,
            pr: canHover ? 3 : 0,
            whiteSpace: "nowrap",
          }}
        >
          {children}
        </Typography>
      </Marquee>
    </Box>
  );
}
