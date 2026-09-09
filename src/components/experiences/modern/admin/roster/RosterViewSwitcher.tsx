"use client";

import { useState } from "react";
import { Button, Stack, ToggleButtonGroup } from "@mui/joy";
import type { User } from "@/lib/features/authentication/types";
import { isStationSignupAdminEnabled } from "@/lib/features/authentication/flags";
import RosterTable from "./RosterTable";
import StationSignupPanel from "./StationSignupPanel";

type RosterView = "roster" | "passcode";

/** Bounds the page to the viewport and scrolls whichever view overflows it. */
const SCROLL_PANE = { flex: 1, minHeight: 0, overflow: "auto" } as const;

/**
 * Segmented control for the admin roster page: the DJ roster and the station
 * signup passcode panel used to stack, which pushed the roster below the fold
 * once the panel gained its status/census detail. They are separate tasks —
 * day-to-day roster management vs. the occasional break-time passcode job — so
 * only one is shown at a time, toggled here.
 *
 * `RosterTable` needs server-derived props, so the page (a server component)
 * passes them through; `StationSignupPanel` reads its own data and only mounts
 * — and only starts polling status — while the passcode view is selected.
 *
 * Defaults to the roster: it is the page's namesake and its most frequent use.
 *
 * The wrapper owns the page's scroll. `Main` is a fixed 100dvh box with
 * overflow:hidden, so a page that owns no scroll container has its overflow
 * clipped away rather than scrolled to, and both views outgrow the viewport —
 * the roster by its account rows, the passcode panel by its status/census
 * detail. `flex` + `minHeight` shrink it to the space left below the page
 * header; `overflow` scrolls the rest.
 *
 * The passcode surface is admin-flag-gated (render-time read of
 * `isStationSignupAdminEnabled`): before launch the flag is off, so there is
 * only one view — the roster — and no toggle is shown at all. That keeps a
 * manager from reaching reveal/rotate controls that would error until
 * Backend-Service's STATION_PASSCODE_KEY is set. When on, the segmented control
 * appears and toggles the two views.
 */
export default function RosterViewSwitcher({
  user,
  organizationSlug,
}: {
  user: User;
  organizationSlug: string;
}) {
  const [view, setView] = useState<RosterView>("roster");

  // Render-time read of a build-time flag: off pre-launch, so the passcode view
  // does not exist and the roster stands alone with no segmented control.
  if (!isStationSignupAdminEnabled()) {
    return (
      <Stack spacing={2} sx={SCROLL_PANE}>
        <RosterTable user={user} organizationSlug={organizationSlug} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={SCROLL_PANE}>
      <ToggleButtonGroup
        value={view}
        variant="outlined"
        color="primary"
        size="sm"
        aria-label="Roster view"
        onChange={(_event, next) => {
          // A ToggleButtonGroup hands back null when the active button is
          // clicked again; ignore it so a view is always selected.
          if (next) setView(next as RosterView);
        }}
        sx={{ alignSelf: "flex-start" }}
      >
        <Button value="roster">DJ Roster</Button>
        <Button value="passcode">Signup Passcode</Button>
      </ToggleButtonGroup>
      {view === "roster" ? (
        <RosterTable user={user} organizationSlug={organizationSlug} />
      ) : (
        <StationSignupPanel />
      )}
    </Stack>
  );
}
