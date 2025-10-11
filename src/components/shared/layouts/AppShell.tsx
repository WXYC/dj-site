"use client";

import { Box } from "@mui/joy";
import { ReactNode } from "react";

/**
 * AppShell - Main application shell wrapper
 * Provides consistent structure for both experiences
 */
interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export default function AppShell({
  children,
  header,
  sidebar,
  footer,
  className,
}: AppShellProps) {
  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        width: "100%",
      }}
    >
      {header && <header>{header}</header>}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {sidebar && <aside>{sidebar}</aside>}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: "auto",
          }}
        >
          {children}
        </Box>
      </Box>
      {footer && <footer>{footer}</footer>}
    </Box>
  );
}

