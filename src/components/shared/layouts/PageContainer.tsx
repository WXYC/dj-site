"use client";

import { Box } from "@mui/joy";
import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: string | number;
  padding?: number | string;
  className?: string;
}

export default function PageContainer({
  children,
  maxWidth = "1400px",
  padding = 3,
  className,
}: PageContainerProps) {
  return (
    <Box
      className={className}
      sx={{
        width: "100%",
        maxWidth,
        margin: "0 auto",
        padding,
      }}
    >
      {children}
    </Box>
  );
}

