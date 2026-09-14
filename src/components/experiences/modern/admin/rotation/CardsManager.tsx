"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAddRotationCardMutation,
  useDeleteRotationCardMutation,
  useGetRotationCardsQuery,
  useUpdateRotationCardMutation,
} from "@/lib/features/rotation/api";
import {
  canDeleteRotationCard,
  groupRotationCardsByBin,
  rotationCardDeleteConflictMessage,
  rotationCardDeleteConflictReason,
} from "@/lib/features/rotation/cards";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationCardWithCount,
} from "@/lib/features/rotation/types";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
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

function CardRow({
  card,
  binLabel,
  deletable,
  pending,
  onRename,
  onDelete,
}: {
  card: RotationCardWithCount;
  binLabel: string;
  deletable: boolean;
  pending: boolean;
  onRename: (name: string | null) => void;
  onDelete: () => void;
}): JSX.Element {
  // Named per card: a grid of identical unlabeled inputs and ✕ buttons tells
  // a screen-reader user nothing about which card they are about to touch.
  const cardName = `${binLabel} card ${card.number}`;

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
        <Typography level="body-sm" fontWeight="lg" color="primary">
          {card.number}
        </Typography>
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
              : "Only a bin's last card can be deleted, and only when it holds no active releases."
          }
          onClick={onDelete}
        >
          <Close fontSize="small" />
        </IconButton>
      </Stack>
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
 */
export default function CardsManager(): JSX.Element {
  const { data: cards, isFetching, isError, refetch } = useGetRotationCardsQuery();
  const [addRotationCard] = useAddRotationCardMutation();
  const [updateRotationCard] = useUpdateRotationCardMutation();
  const [deleteRotationCard] = useDeleteRotationCardMutation();
  const [pendingCardIds, setPendingCardIds] = useState<ReadonlySet<number>>(() => new Set());

  const cardsByBin = useMemo(() => groupRotationCardsByBin(cards ?? []), [cards]);

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

  const addCard = (bin: (typeof ROTATION_BINS)[number]) =>
    void (async () => {
      try {
        const created = await addRotationCard({ bin }).unwrap();
        // The server's assignment, echoed — never a locally computed max+1.
        toast.success(`Added card ${created.number} to ${ROTATION_BIN_LABELS[bin]}.`);
      } catch (err) {
        if (isUnmessagedHttpError(err)) {
          toast.error(
            `Couldn't add a card to ${ROTATION_BIN_LABELS[bin]}. Please try again.`,
          );
        }
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
                  binLabel={ROTATION_BIN_LABELS[bin]}
                  deletable={canDeleteRotationCard(card, binCards)}
                  pending={pendingCardIds.has(card.id)}
                  onRename={(name) => renameCard(card.id, name)}
                  onDelete={() => deleteCard(card.id)}
                />
              ))}
              <Button
                variant="outlined"
                size="sm"
                startDecorator={<Add fontSize="small" />}
                aria-label={`Add a card to ${ROTATION_BIN_LABELS[bin]}`}
                onClick={() => addCard(bin)}
              >
                Add card
              </Button>
            </Stack>
          </Sheet>
        );
      })}
    </Box>
  );
}
