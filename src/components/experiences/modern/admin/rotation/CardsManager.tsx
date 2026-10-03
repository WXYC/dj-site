"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAddRotationCardMutation,
  useDeleteRotationCardMutation,
  useGetRotationCardsQuery,
  useGetRotationListQuery,
  useUpdateRotationCardMutation,
} from "@/lib/features/rotation/api";
import {
  canDeleteRotationCard,
  groupRotationCardsByBin,
  groupRotationRowsByCardId,
  rotationCardDeleteConflictMessage,
  rotationCardDeleteConflictReason,
  rotationRecordLabel,
} from "@/lib/features/rotation/cards";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationCardWithCount,
  type RotationListRow,
} from "@/lib/features/rotation/types";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";
import CardAssignmentPanel from "./CardAssignmentPanel";
import { Add, Close } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Input,
  LinearProgress,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";

// A design-review proposal, kept in one place so changing it is a one-line edit.
const CARD_RECORDS_PREVIEW = 5;

function CardRow({
  card,
  bin,
  binLabel,
  deletable,
  pending,
  records,
  onRename,
  onDelete,
  onAssign,
}: {
  card: RotationCardWithCount;
  bin: RotationBin;
  binLabel: string;
  deletable: boolean;
  pending: boolean;
  /** Null until a list read succeeds, so an unread card never claims "Nothing on this card yet." */
  records: readonly RotationListRow[] | null;
  onRename: (name: string | null) => void;
  onDelete: () => void;
  onAssign: () => void;
}): JSX.Element {
  // Named per card: a grid of identical unlabeled inputs and ✕ buttons tells
  // a screen-reader user nothing about which card they are about to touch.
  // Spelled the way MDs say it, same as the panel's own title ("Heavy 2").
  const cardName = `${binLabel} ${card.number}`;
  const [expanded, setExpanded] = useState(false);
  // A CardRow is keyed by card id and survives the refetches that resize its
  // own list, so `expanded` would otherwise outlive a dip to the preview
  // count or below -- where the toggle is hidden, so nothing can set it back
  // to false -- and reappear fully open, with a "Show fewer" nobody pressed,
  // once the count climbs past the preview again. React's "adjust state
  // while rendering" pattern (comparing against the last count seen, and
  // resetting inline before this render's JSX is produced) collapses the
  // card the moment it stops needing the toggle, with no effect.
  const recordCount = records?.length ?? 0;
  const [lastRecordCount, setLastRecordCount] = useState(recordCount);
  if (recordCount !== lastRecordCount) {
    setLastRecordCount(recordCount);
    if (recordCount <= CARD_RECORDS_PREVIEW) setExpanded(false);
  }

  const commitRename = (raw: string) => {
    const next = raw.trim() || null;
    if (next !== (card.name ?? null)) onRename(next);
  };

  return (
    <Sheet
      variant="outlined"
      data-testid={`rotation-card-${card.id}`}
      sx={{ borderRadius: "md", px: 1, py: 0.5 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {/* Decorative badge; the card's number stays in the accessible tree
            through the name input's "Name for <Bin> N" label beside it. */}
        <RotationCardBadge number={card.number} bin={bin} />
        <Input
          // Uncontrolled, remounted whenever the server's name changes: the
          // DOM keeps the operator's text through the save round-trip, and
          // the refetched name arriving as a fresh defaultValue is the one
          // moment the two must reconcile — no second, mirrored copy of the
          // server value in state.
          key={card.name ?? ""}
          size="sm"
          variant="plain"
          placeholder="unnamed"
          disabled={pending}
          sx={{ flex: 1, minWidth: 0 }}
          slotProps={{
            input: {
              defaultValue: card.name ?? "",
              "aria-label": `Name for ${cardName}`,
              onBlur: (event) => commitRename(event.currentTarget.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              },
            },
          }}
        />
        <Typography level="body-xs" textColor="text.tertiary" sx={{ whiteSpace: "nowrap" }}>
          {card.active_count} active
        </Typography>
        <IconButton
          size="sm"
          variant="plain"
          color="danger"
          disabled={!deletable || pending}
          aria-label={`Delete: ${cardName}`}
          title={
            deletable
              ? undefined
              : "Only a bin's last card can be deleted, when it holds no active releases — and never its only card."
          }
          onClick={onDelete}
        >
          <Close fontSize="small" />
        </IconButton>
      </Stack>
      <Button
        variant="plain"
        size="sm"
        disabled={pending}
        // The card as MDs say it and as the panel is titled: "Heavy 3".
        aria-label={`Assign records: ${binLabel} ${card.number}`}
        sx={{ px: 0, mt: 0.25, justifyContent: "flex-start" }}
        onClick={onAssign}
      >
        Assign records
      </Button>
      {/* active_count above is the server's own count of every active row on
          this card; the list below is the deduplicated status=active read,
          which collapses several active rows for one release in one bin into
          the most recently added one. The two can disagree for as long as a
          duplicate stays active -- that is expected, and the two are never
          reconciled against each other. When they disagree with an empty
          list -- the card's one active row is a duplicate the read collapsed
          onto a sibling card -- "Nothing on this card yet." stays off too:
          an empty list is not the same claim as an empty card, and showing
          the empty line here would make it one. */}
      {records != null && records.length === 0 && card.active_count === 0 && (
        <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 0.5 }}>
          Nothing on this card yet.
        </Typography>
      )}
      {records != null && records.length > 0 && (
        <>
          <Box
            component="ul"
            // listStyle: none drops the implicit list role in WebKit, so
            // state it explicitly for screen-reader users.
            role="list"
            aria-label={`Records on ${cardName}`}
            sx={{ listStyle: "none", m: 0, mt: 0.5, p: 0 }}
          >
            {(expanded ? records : records.slice(0, CARD_RECORDS_PREVIEW)).map((row) => (
              <Typography
                component="li"
                key={row.rotation_id}
                level="body-xs"
                noWrap
                title={rotationRecordLabel(row)}
              >
                {rotationRecordLabel(row)}
              </Typography>
            ))}
          </Box>
          {records.length > CARD_RECORDS_PREVIEW && (
            <Button
              variant="plain"
              size="sm"
              aria-expanded={expanded}
              // Visible text stays short ("Show all N" / "Show fewer");
              // the accessible name carries which card it's for, like
              // every other control in the row.
              aria-label={
                expanded
                  ? `Show fewer records on ${cardName}`
                  : `Show all ${records.length} records on ${cardName}`
              }
              sx={{ px: 0, justifyContent: "flex-start" }}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? "Show fewer" : `Show all ${records.length}`}
            </Button>
          )}
        </>
      )}
    </Sheet>
  );
}

/**
 * The Cards tab: every bin's cards in one grid, with inline rename (names
 * are optional), an add affordance, and delete for the one card the server
 * will accept deleting — its bin's last, empty one.
 *
 * The card's number is never computed here: the server assigns max+1 on
 * add, and the number a new card shows is whatever the mutation returned.
 * Per-card active counts come from the cards read itself; the membership
 * mutations invalidate it, so list-side kills, adds, and moves reach these
 * counts through the same refetch every other consumer relies on.
 *
 * Owns which card the assignment panel is open on and, from that, the next
 * card along the shelf (`nextAssigningCard`) that Save & open advances to.
 * The panel is keyed by card id, so advancing remounts it onto the next card
 * fresh rather than retargeting the mounted one. Also owns the "Still on
 * `<Bin>` 1" toggle, beside `assigningCardId`, so it is the two of them
 * together -- not the remount -- that decide what the next panel opens
 * with: the toggle rides along through `next.open()` but is reset to off by
 * `onClose` and by a fresh `onAssign`.
 */
export default function CardsManager(): JSX.Element {
  const { data: cards, isFetching, isError, refetch } = useGetRotationCardsQuery();
  // The panel's own cache entry: `status=active`, never `status=all`.
  const list = useGetRotationListQuery("active");
  const [addRotationCard] = useAddRotationCardMutation();
  const [updateRotationCard] = useUpdateRotationCardMutation();
  const [deleteRotationCard] = useDeleteRotationCardMutation();
  const [pendingCardIds, setPendingCardIds] = useState<ReadonlySet<number>>(() => new Set());
  // The one write here that predates its card: there is no card id for
  // `withPendingCard` to key on until the server answers, so the in-flight
  // guard keys on the bin instead. Without it a second click fires a second
  // create — a phantom card the physical bin doesn't have, which every
  // omitted-card_id rotation add then lands on.
  const [pendingAddBin, setPendingAddBin] = useState<RotationBin | null>(null);
  const [assigningCardId, setAssigningCardId] = useState<number | null>(null);
  const [stillOnFirstCardOnly, setStillOnFirstCardOnly] = useState(false);

  const cardsByBin = useMemo(() => groupRotationCardsByBin(cards ?? []), [cards]);
  const recordsByCardId = useMemo(
    () => (list.data ? groupRotationRowsByCardId(list.data) : null),
    [list.data],
  );
  // Derived from the cards read, never held beside it: a card that leaves
  // the list takes its open panel with it.
  const assigningCard = cards?.find((card) => card.id === assigningCardId);
  // The walk's next step: the same bin's cards are already in number order, so
  // the card one past the open one's index is the next one along the shelf.
  const binCardsForAssign = assigningCard ? cardsByBin.get(assigningCard.bin) ?? [] : [];
  const nextAssigningCard = assigningCard
    ? binCardsForAssign[binCardsForAssign.findIndex((c) => c.id === assigningCard.id) + 1] ?? null
    : null;

  const withPendingCard = async (cardId: number, run: () => Promise<unknown>) => {
    setPendingCardIds((prev) => new Set(prev).add(cardId));
    try {
      await run();
    } finally {
      setPendingCardIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const renameCard = (cardId: number, name: string | null) =>
    void withPendingCard(cardId, async () => {
      try {
        await updateRotationCard({ id: cardId, name }).unwrap();
      } catch (err) {
        // The rename's refusals reach the shared middleware's toast; only
        // the shapes it stays silent about are this surface's to report.
        if (isUnmessagedHttpError(err)) {
          toast.error("Couldn't rename this card. Please try again.");
        }
      }
    });

  const deleteCard = (cardId: number) =>
    void withPendingCard(cardId, async () => {
      try {
        await deleteRotationCard(cardId).unwrap();
      } catch (err) {
        // The delete's rejections are wrapped out of the middleware, so this
        // is the one reporter: the guard 409's typed reason gets its own
        // sentence, everything else the server's message or the fallback.
        const reason = rotationCardDeleteConflictReason(err);
        toast.error(
          reason != null
            ? rotationCardDeleteConflictMessage(reason)
            : rotationWriteErrorMessage(err, "Couldn't delete this card. Please try again."),
        );
      }
    });

  const addCard = (bin: RotationBin) =>
    void (async () => {
      setPendingAddBin(bin);
      try {
        const created = await addRotationCard({ bin }).unwrap();
        // The server's assignment, echoed — never a locally computed max+1.
        toast.success(`Added ${ROTATION_BIN_LABELS[bin]} ${created.number}.`);
      } catch (err) {
        if (isUnmessagedHttpError(err)) {
          toast.error(
            `Couldn't add a card to ${ROTATION_BIN_LABELS[bin]}. Please try again.`,
          );
        }
      } finally {
        setPendingAddBin(null);
      }
    })();

  // Absence-of-list, not the error flag: a background refetch can leave
  // isError true while the last-good cards are still on screen, and a
  // query-fed grid must never render an outage as "there are none".
  if (isError && cards == null) {
    return (
      <Alert color="danger" sx={{ justifyContent: "space-between" }}>
        <Typography>Could not load the rotation cards.</Typography>
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
  if (cards == null) return <LinearProgress aria-label="Loading rotation cards" />;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 2,
        maxWidth: 1020,
      }}
    >
      {list.isError && list.data == null && (
        <Alert color="danger" sx={{ gridColumn: "1 / -1", justifyContent: "space-between" }}>
          <Typography>Couldn't load the records on these cards.</Typography>
          <Button
            variant="outlined"
            color="danger"
            size="sm"
            loading={list.isFetching}
            onClick={() => void list.refetch()}
          >
            Retry
          </Button>
        </Alert>
      )}
      {ROTATION_BINS.map((bin) => {
        const binCards = cardsByBin.get(bin) ?? [];
        return (
          <Sheet
            key={bin}
            variant="soft"
            data-testid={`rotation-cards-bin-${bin}`}
            sx={{ borderRadius: "lg", p: 2 }}
          >
            <Typography component="h3" level="title-sm" sx={{ mb: 1 }}>
              {ROTATION_BIN_LABELS[bin]}{" "}
              <Typography textColor="text.tertiary" fontSize="xs">
                {bin} · {binCards.length} {binCards.length === 1 ? "card" : "cards"}
              </Typography>
            </Typography>
            <Stack spacing={1}>
              {binCards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  bin={bin}
                  binLabel={ROTATION_BIN_LABELS[bin]}
                  deletable={canDeleteRotationCard(card, binCards)}
                  pending={pendingCardIds.has(card.id)}
                  records={recordsByCardId ? (recordsByCardId.get(card.id) ?? []) : null}
                  onRename={(name) => renameCard(card.id, name)}
                  onDelete={() => deleteCard(card.id)}
                  onAssign={() => {
                    setAssigningCardId(card.id);
                    setStillOnFirstCardOnly(false);
                  }}
                />
              ))}
              <Button
                variant="outlined"
                size="sm"
                startDecorator={<Add fontSize="small" />}
                aria-label={`Add a card to ${ROTATION_BIN_LABELS[bin]}`}
                // Every bin's affordance waits, not just the clicked one: the
                // number the toast echoes is the server's assignment, and two
                // concurrent creates would race for it.
                disabled={pendingAddBin != null}
                loading={pendingAddBin === bin}
                onClick={() => addCard(bin)}
              >
                Add card
              </Button>
            </Stack>
          </Sheet>
        );
      })}
      {assigningCard && (
        <CardAssignmentPanel
          // The panel's ticks belong to one card and must not ride to the next.
          key={assigningCard.id}
          card={assigningCard}
          onClose={() => {
            setAssigningCardId(null);
            setStillOnFirstCardOnly(false);
          }}
          next={
            nextAssigningCard
              ? { card: nextAssigningCard, open: () => setAssigningCardId(nextAssigningCard.id) }
              : undefined
          }
          stillOnFirstCardOnly={stillOnFirstCardOnly}
          setStillOnFirstCardOnly={setStillOnFirstCardOnly}
        />
      )}
    </Box>
  );
}
