"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, Chip, List, ListItem, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import {
  isIntakeStateChanged,
  useAcceptIntakeItemMutation,
  useCheckoutIntakeItemMutation,
  useGetIntakeItemsQuery,
  usePassIntakeItemMutation,
  useReleaseIntakeItemMutation,
} from "@/lib/features/reviews/api";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import ConfirmDialog from "../ConfirmDialog";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

export default function ReviewsPile() {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  const me = user?.id;
  const visible = canSeeReviews(user?.authority ?? Authorization.NO);

  const open = useGetIntakeItemsQuery(undefined, { skip: !visible });
  const reviewed = useGetIntakeItemsQuery({ state: "reviewed" }, { skip: !visible });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !visible });

  const [checkout] = useCheckoutIntakeItemMutation();
  const [release] = useReleaseIntakeItemMutation();
  const [accept] = useAcceptIntakeItemMutation();
  const [pass] = usePassIntakeItemMutation();
  const [returning, setReturning] = useState<IntakeItem | null>(null);
  // The write in flight per row, by item id: its button shows loading and the
  // row's others are disabled. The ref is the synchronous guard, so a second
  // click that lands before the re-render is a no-op too.
  const inFlight = useRef(new Map<number, string>());
  const [pending, setPending] = useState<ReadonlyMap<number, string>>(() => new Map());

  if (!visible) return null;
  if (open.isError || reviewed.isError) {
    return <Typography role="alert">Couldn't load the Pile. Please try again.</Typography>;
  }

  // Until both lists land, an empty-state sentence would read as a fact.
  if (!open.data || !reviewed.data) return null;

  const items = open.data;
  const inPile = items.filter((i) => i.effective_state === "pool");
  const requests = items.filter((i) => i.effective_state === "requested" && i.requested_dj_id === me);
  const checkouts = [
    ...items.filter((i) => i.effective_state === "checked_out" && i.checked_out_by === me),
    ...reviewed.data.filter((i) => i.effective_state === "reviewed" && i.checked_out_by === me),
  ];

  // A double-click's second POST would find the record already moved and
  // answer 409 state_changed, telling the DJ someone else took the record they
  // just took; one write per row at a time.
  const act = async (id: number, action: string, run: () => { unwrap: () => Promise<unknown> }) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.set(id, action);
    setPending(new Map(inFlight.current));
    try {
      await run().unwrap();
    } catch (err) {
      // Both lists refetch on a write, lost race or not. A lost race is not an
      // error, so it is not an error toast.
      if (isIntakeStateChanged(err)) {
        toast("Someone else got to this record first. The lists are up to date.");
      } else {
        toast.error("Couldn't do that. Please try again.");
      }
    } finally {
      inFlight.current.delete(id);
      setPending(new Map(inFlight.current));
    }
  };

  // Joy's Button disables itself while `loading`.
  const lock = (i: IntakeItem, action: string) => ({
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
      {section("The Pile", inPile, "Nothing is waiting in the Pile.", (i) => (
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
          <Button size="sm" variant="outlined" {...lock(i, "release")} onClick={() => setReturning(i)}>Return to the Pile</Button>
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
        title="Return to the Pile"
        actions={
          <>
            <Button
              {...(returning ? lock(returning, "release") : {})}
              onClick={async () => {
                const id = returning!.id;
                setReturning(null);
                await act(id, "release", () => release(id));
              }}
            >
              Return to the Pile
            </Button>
            <Button variant="plain" onClick={() => setReturning(null)}>Cancel</Button>
          </>
        }
      >
        {returning?.effective_state === "reviewed"
          ? "Have you brought this record back to the station?"
          : "Put this record back in the Pile?"}
      </ConfirmDialog>
    </Stack>
  );
}
