"use client";

import type { JSX } from "react";
import { Box } from "@mui/joy";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * `count` draws a pill after the label only above zero; `countLabel` is its spoken form, read after the label.
 * The two go together: a count with no spoken form would run its digits into the label ("First12").
 */
export type PageTab = { path: string; label: string } & (
  | { count: number; countLabel: string }
  | { count?: undefined; countLabel?: undefined }
);

/** Takes text out of sight but leaves it in the accessible name. */
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

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
