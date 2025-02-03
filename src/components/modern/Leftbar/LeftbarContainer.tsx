"use client";

import Logo from "@/src/components/Branding/Logo";
import Box from "@mui/joy/Box";
import GlobalStyles from "@mui/joy/GlobalStyles";
import Sheet from "@mui/joy/Sheet";
import { usePathname } from "next/navigation";

export default function LeftbarContainer({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const path = usePathname();

  return (
    <Sheet
      className="FirstSidebar"
      variant="soft"
      color={path.includes("admin") ? "success" : "primary"}
      invertedColors
      sx={{
        position: {
          xs: "fixed",
          md: "sticky",
        },
        transform: {
          xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
          md: "none",
        },
        transition: "transform 0.4s",
        zIndex: 10000,
        height: "100dvh",
        width: "var(--FirstSidebar-width)",
        top: 0,
        p: 1.5,
        py: 3,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        borderRight: "1px solid",
        borderColor: "divider",
      }}
      suppressHydrationWarning
    >
      <GlobalStyles
        styles={{
          ":root": {
            "--FirstSidebar-width": "68px",
          },
        }}
      />
      <Box>
        <Logo color={path.includes("admin") ? "success" : "primary"} />
      </Box>
      {children}
    </Sheet>
  );
}
