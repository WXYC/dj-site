"use client";

import type { JSX } from "react";
import { Box } from "@mui/joy";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { path: "/dashboard/admin/rotation/new", label: "Add to rotation" },
  { path: "/dashboard/admin/rotation", label: "Rotation list" },
  { path: "/dashboard/admin/rotation/cards", label: "Cards" },
] as const;

export default function RotationTabs(): JSX.Element {
  const pathname = usePathname();

  return (
    <Box sx={{ display: "flex", gap: 1, borderBottom: "1px solid", borderColor: "divider", mb: 2 }}>
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        return (
          <Box
            key={tab.path}
            component={Link}
            href={tab.path}
            aria-current={active ? "page" : undefined}
            sx={{
              px: 1.5,
              py: 1,
              textDecoration: "none",
              color: active ? "primary.plainColor" : "text.secondary",
              fontWeight: active ? "lg" : "md",
              borderBottom: "2px solid",
              borderColor: active ? "primary.solidBg" : "transparent",
            }}
          >
            {tab.label}
          </Box>
        );
      })}
    </Box>
  );
}
