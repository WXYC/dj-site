"use client";

import type { JSX } from "react";
import { Box } from "@mui/joy";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VISUALLY_HIDDEN } from "./visuallyHidden";

/**
 * `count` draws a pill after the label only above zero; `countLabel` is its spoken form, read after the label.
 * The two go together: a count with no spoken form would run its digits into the label ("First12").
 */
export type PageTab = { path: string; label: string } & (
  | { count: number; countLabel: string }
  | { count?: undefined; countLabel?: undefined }
);

/**
 * A strip of route links for sibling pages. A tab is current only when the
 * pathname equals its path exactly, so a nested route marks none current.
 */
export default function PageTabs({ tabs }: { tabs: readonly PageTab[] }): JSX.Element {
  const pathname = usePathname();

  return (
    <Box sx={{ display: "flex", gap: 1, borderBottom: "1px solid", borderColor: "divider", mb: 2 }}>
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <Box
            key={tab.path}
            component={Link}
            href={tab.path}
            aria-current={active ? "page" : undefined}
            sx={{
              position: "relative",
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
            {tab.count !== undefined && tab.count > 0 && (
              <>
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    ml: 1,
                    px: 0.75,
                    borderRadius: "lg",
                    fontSize: "xs",
                    fontWeight: "lg",
                    bgcolor: "primary.solidBg",
                    color: "primary.solidColor",
                  }}
                >
                  {tab.count}
                </Box>
                <Box component="span" sx={VISUALLY_HIDDEN}>{`, ${tab.countLabel}`}</Box>
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
