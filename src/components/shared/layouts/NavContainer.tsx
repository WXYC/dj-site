"use client";

import { Box } from "@mui/joy";
import { ReactNode } from "react";

interface NavContainerProps {
  children: ReactNode;
  orientation?: "horizontal" | "vertical";
  position?: "fixed" | "sticky" | "relative";
  className?: string;
}

export default function NavContainer({
  children,
  orientation = "horizontal",
  position = "relative",
  className,
}: NavContainerProps) {
  return (
    <Box
      component="nav"
      className={className}
      sx={{
        display: "flex",
        flexDirection: orientation === "vertical" ? "column" : "row",
        position,
      }}
    >
      {children}
    </Box>
  );
}

