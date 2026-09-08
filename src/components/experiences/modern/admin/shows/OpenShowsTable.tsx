"use client";

import { useGetOpenShowsQuery } from "@/lib/features/flowsheet/api";
import type { OpenShow } from "@/lib/features/flowsheet/types";
import { Alert, Button, Chip, Sheet, Stack, Table, Typography } from "@mui/joy";
import { useState } from "react";
import ForceEndDialog from "./ForceEndDialog";

/**
 * The widened request reaches for the whole backlog: the window maximum the
 * backend accepts (30 years, sized to reach its oldest open shows) and its
 * per-request row ceiling. Two canned windows — the default and everything —
 * cover both real tasks (recent cleanup; full audit) without asking an
 * operator to know the backend's caps.
 */
const FULL_WINDOW = { windowHours: 262_800, limit: 500 } as const;

export default function OpenShowsTable() {
  const [widened, setWidened] = useState(false);
  const { data, isError, isFetching, refetch } = useGetOpenShowsQuery(
    widened ? FULL_WINDOW : {}
  );
  const [target, setTarget] = useState<OpenShow | null>(null);

  // The read opts out of the non-JSON soft-fail upstream, so a dead backend
  // lands here as an error — never as the empty state below, which would
  // report the cleanup as done.
  if (isError) {
    return (
      <Alert color="danger" sx={{ m: 2, justifyContent: "space-between" }}>
        <Typography>Could not load the open shows list.</Typography>
        <Button
          variant="outlined"
          color="danger"
          size="sm"
          loading={isFetching}
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </Alert>
    );
  }

  if (!data) return null;

  const truncated = data.shows.length < data.total_in_window;

  return (
    // Main is a fixed-height box with overflow hidden, so this table owns its
    // scroll container — without it a widened 500-row list is clipped below
    // the fold rather than scrolled to.
    <Sheet
      sx={{ width: "100%", height: "100%", overflow: "auto", bgcolor: "transparent" }}
    >
      <Stack spacing={1} sx={{ p: 2 }}>
        {truncated ? (
          <Typography level="body-sm" color="warning">
            Showing {data.shows.length} of {data.total_in_window} open shows in
            this window.
          </Typography>
        ) : null}
        {!widened && data.older_open_show_count > 0 ? (
          <Typography level="body-sm">
            {data.older_open_show_count} older open{" "}
            {data.older_open_show_count === 1 ? "show" : "shows"} before this
            window.{" "}
            <Button
              variant="plain"
              size="sm"
              loading={isFetching}
              onClick={() => setWidened(true)}
              data-testid="open-shows-show-all"
            >
              Show all
            </Button>
          </Typography>
        ) : null}
        {data.shows.length === 0 ? (
          <Typography level="body-md" sx={{ py: 4, textAlign: "center" }}>
            No open shows — nothing to clean up.
          </Typography>
        ) : (
          <Table stickyHeader sx={{ "& td": { verticalAlign: "middle" } }}>
            <thead>
              <tr>
                <th>Started</th>
                <th>DJ</th>
                <th>Show</th>
                <th style={{ width: "12%" }}>Entries</th>
                <th style={{ width: "18%" }}>Status</th>
                <th style={{ width: "12%" }} aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {data.shows.map((show) => (
                <tr key={show.id} data-testid={`open-show-row-${show.id}`}>
                  <td title={show.start_time}>
                    {new Date(show.start_time).toLocaleString()}
                  </td>
                  <td>{show.dj_name ?? "—"}</td>
                  <td>{show.show_name ?? "—"}</td>
                  <td>{show.entry_count}</td>
                  <td>
                    <Stack direction="row" spacing={0.5}>
                      {show.is_current ? (
                        <Chip color="danger" size="sm" variant="solid">
                          ON AIR
                        </Chip>
                      ) : null}
                      {show.likely_abandoned ? (
                        <Chip color="warning" size="sm" variant="soft">
                          likely abandoned
                        </Chip>
                      ) : null}
                    </Stack>
                  </td>
                  <td>
                    <Button
                      variant="outlined"
                      color={show.is_current ? "danger" : "neutral"}
                      size="sm"
                      onClick={() => setTarget(show)}
                      data-testid={`open-show-end-${show.id}`}
                    >
                      End
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Stack>
      {/* Keyed by show id so the dialog's escalation state resets with the
          target instead of leaking a previous show's 409 into a new one. */}
      {target ? (
        <ForceEndDialog
          key={target.id}
          show={target}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </Sheet>
  );
}
