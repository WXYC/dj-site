"use client";

import { useState } from "react";
import { Button, Stack, ToggleButtonGroup } from "@mui/joy";
import type { User } from "@/lib/features/authentication/types";
import RosterTable from "./RosterTable";
import StationSignupPanel from "./StationSignupPanel";

type RosterView = "roster" | "passcode";

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
 */
export default function RosterViewSwitcher({
  user,
  organizationSlug,
}: {
  user: User;
  organizationSlug: string;
}) {
  const [view, setView] = useState<RosterView>("roster");

  return (
    <Stack spacing={2}>
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
