"use client";

import { useState, type ReactNode } from "react";
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

  const act = async (run: () => { unwrap: () => Promise<unknown> }) => {
    try {
      await run().unwrap();
    } catch (err) {
      // Both lists refetch on a write, lost race or not.
      toast.error(
        isIntakeStateChanged(err)
          ? "Someone else got to this record first. The lists are up to date."
          : "Couldn't do that. Please try again.",
      );
    }
  };

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
          <Button size="sm" onClick={() => act(() => checkout(i.id))}>Check out</Button>
        </>
      ))}
      {section("My checkouts", checkouts, "You have no records checked out.", (i) => (
        <>
          <Typography level="body-sm">Taken {day(i.checked_out_at)}</Typography>
          {i.overdue && <Chip color="danger">Overdue</Chip>}
          {i.effective_state === "reviewed" && (
            <Typography level="body-sm">Reviewed. Bring the record back to the music office.</Typography>
          )}
          <Button size="sm" variant="outlined" onClick={() => setReturning(i)}>Return to the Pile</Button>
        </>
      ))}
      {section("Requests for me", requests, "No one has asked you for a review.", (i) => (
        <>
          <Typography level="body-sm">Asked {day(i.requested_at)}</Typography>
          <Button size="sm" onClick={() => act(() => accept(i.id))}>Accept</Button>
          <Button size="sm" variant="outlined" onClick={() => act(() => pass(i.id))}>Pass</Button>
        </>
      ))}
      <ConfirmDialog
        open={returning !== null}
        onClose={() => setReturning(null)}
        title="Return to the Pile"
        actions={
          <>
            <Button
              onClick={async () => {
                const id = returning!.id;
                setReturning(null);
                await act(() => release(id));
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
