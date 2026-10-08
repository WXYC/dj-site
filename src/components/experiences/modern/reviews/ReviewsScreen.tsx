"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Chip, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import {
  isIntakeStateChanged,
  reviewsApi,
  useAcceptIntakeItemMutation,
  useCheckoutIntakeItemMutation,
  useGetIntakeItemsQuery,
  usePassIntakeItemMutation,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/api";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useAppDispatch } from "@/lib/hooks";
import ConfirmDialog from "../ConfirmDialog";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

type Action = "checkout" | "accept" | "pass" | "release";

/** What a lost race (409 `state_changed`) means for each button, shown once the lists have reloaded. */
const RACE_NOTICE: Record<Action, string> = {
  checkout: "This record left the review shelf before your click went through. The lists have been reloaded.",
  accept: "This request is no longer open; it may have expired. The lists have been reloaded.",
  pass: "This request is no longer open; it may have expired. The lists have been reloaded.",
  release: "This record is no longer checked out to you. The lists have been reloaded.",
};

// One argument per list, shared by its hook and the post-write reload so the
// reload reaches the same cache entry.
const OPEN_LISTS = undefined;
const REVIEWED_LIST = { state: "reviewed" } as const;

export default function ReviewsScreen() {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const me = user?.id;
  const visible = canSeeReviews(user?.authority ?? Authorization.NO);

  const open = useGetIntakeItemsQuery(OPEN_LISTS, { skip: !visible });
  const reviewed = useGetIntakeItemsQuery(REVIEWED_LIST, { skip: !visible });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !visible });

  const [checkout] = useCheckoutIntakeItemMutation();
  const [release] = useReleaseIntakeItemMutation();
  const [accept] = useAcceptIntakeItemMutation();
  const [pass] = usePassIntakeItemMutation();
  const [returning, setReturning] = useState<IntakeItem | null>(null);
  // The write in flight per row, by item id: its button shows loading and the
  // row's others are disabled. The ref is the synchronous guard, so a second
  // click that lands before the re-render is a no-op too.
  const inFlight = useRef(new Map<number, Action>());
  const [pending, setPending] = useState<ReadonlyMap<number, Action>>(() => new Map());
  const dispatch = useAppDispatch();
  // A write outlives the page when the DJ navigates away mid-click; what
  // follows it must then touch neither React state nor the screen's toasts.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!visible) return null;
  if (open.isError || reviewed.isError) {
    return <Typography role="alert">Couldn't load the review shelf. Please try again.</Typography>;
  }

  // Until both lists land, an empty-state sentence would read as a fact.
  if (!open.data || !reviewed.data) return null;

  const items = open.data;
  const onShelf = items.filter((i) => i.effective_state === "pool");
  const requests = items.filter((i) => i.effective_state === "requested" && i.requested_dj_id === me);
  const checkouts = [
    ...items.filter((i) => i.effective_state === "checked_out" && i.checked_out_by === me),
    ...reviewed.data.filter((i) => i.effective_state === "reviewed" && i.checked_out_by === me),
  ];

  // A double-click's second POST would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took; one write per row at a time.
  const act = async (id: number, action: Action, run: () => { unwrap: () => Promise<unknown> }) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.set(id, action);
    setPending(new Map(inFlight.current));
    let raced = false;
    try {
      await run().unwrap();
    } catch (err) {
      // Both lists refetch on a write, lost race or not. A lost race is not an
      // error, so it is not an error toast.
      if (isIntakeStateChanged(err)) {
        raced = true;
      } else {
        toast.error("Couldn't do that. Please try again.");
      }
    } finally {
      // The row leaves its section only when the refetched lists land, so it
      // stays locked until then. A failed write or a lost race refetches too,
      // so the row unlocks once the lists settle either way. Each reload joins
      // the one the write's invalidation already started. It goes through the
      // store, not the hooks' `refetch`, which throws once the page has
      // unmounted; `allSettled` never rejects.
      await Promise.allSettled([
        dispatch(reviewsApi.endpoints.getIntakeItems.initiate(OPEN_LISTS, { subscribe: false, forceRefetch: true })),
        dispatch(reviewsApi.endpoints.getIntakeItems.initiate(REVIEWED_LIST, { subscribe: false, forceRefetch: true })),
      ]);
      inFlight.current.delete(id);
      if (mounted.current) setPending(new Map(inFlight.current));
    }
    // The notice says the lists have been reloaded, so it waits until they have.
    if (raced && mounted.current) toast(RACE_NOTICE[action]);
  };

  // Joy's Button disables itself while `loading`.
  const lock = (i: IntakeItem, action: Action) => ({
    loading: pending.get(i.id) === action,
    disabled: pending.has(i.id),
  });

  const describe = (i: IntakeItem) => {
    const format = formats?.find((f) => f.id === i.format_id)?.format_name;
    return [i.artist_name, i.album_title, i.record_label, format].filter(Boolean).join(" · ");
  };

  const section = (title: string, rows: IntakeItem[], empty: string, extra: (i: IntakeItem) => ReactNode) => (
    <section aria-label={title}>
      <Typography level="title-lg">{title}</Typography>
      {rows.length === 0 ? (
        <Typography level="body-sm">{empty}</Typography>
      ) : (
        <List>
          {rows.map((i) => (
            <ListItem key={i.id}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography>{describe(i)}</Typography>
                {extra(i)}
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </section>
  );

  return (
    <Stack spacing={3}>
      {section("The review shelf", onShelf, "Nothing is waiting on the review shelf.", (i) => (
        <>
          <Typography level="body-sm">Logged {day(i.logged_at)}</Typography>
          <Button size="sm" {...lock(i, "checkout")} onClick={() => act(i.id, "checkout", () => checkout(i.id))}>Check out</Button>
        </>
      ))}
      {section("My checkouts", checkouts, "You have no records checked out.", (i) => (
        <>
          <Typography level="body-sm">Taken {day(i.checked_out_at)}</Typography>
          {i.overdue && <Chip color="danger">Overdue</Chip>}
          {i.effective_state === "reviewed" && (
            <Typography level="body-sm">Reviewed. Bring the record back to the music office.</Typography>
          )}
          <Button size="sm" variant="outlined" {...lock(i, "release")} onClick={() => setReturning(i)}>Return to the review shelf</Button>
        </>
      ))}
      {section("Requests for me", requests, "No one has asked you for a review.", (i) => (
        <>
          <Typography level="body-sm">Asked {day(i.requested_at)}</Typography>
          <Button size="sm" {...lock(i, "accept")} onClick={() => act(i.id, "accept", () => accept(i.id))}>Accept</Button>
          <Button size="sm" variant="outlined" {...lock(i, "pass")} onClick={() => act(i.id, "pass", () => pass(i.id))}>Pass</Button>
        </>
      ))}
      <ConfirmDialog
        open={returning !== null}
        onClose={() => setReturning(null)}
        title="Return to the review shelf"
        actions={
          <>
            <Button
              onClick={async () => {
                const id = returning!.id;
                setReturning(null);
                await act(id, "release", () => release(id));
              }}
            >
              Return to the review shelf
            </Button>
            <Button variant="plain" onClick={() => setReturning(null)}>Cancel</Button>
          </>
        }
      >
        Have you brought this record back to the station?
      </ConfirmDialog>
    </Stack>
  );
}
