"use client";

import type { JSX } from "react";
import { Fragment, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Box,
  Button,
  Chip,
  Input,
  Option,
  Select,
  Sheet,
  Skeleton,
  Stack,
  Table,
  ToggleButtonGroup,
  Typography,
} from "@mui/joy";
import { Add, Search, TimerOutlined, TuneOutlined } from "@mui/icons-material";
import { isoDateToUTCDays, isPastWindow } from "@/lib/features/rotation/age";
import {
  rotationRowPresentation,
  selectRotationAdminView,
  type RotationAdminSort,
} from "@/lib/features/rotation/adminList";
import {
  canDeleteRotationCard,
  groupRotationCardsByBin,
} from "@/lib/features/rotation/cards";
import {
  useGetRotationCardsQuery,
  useGetRotationListQuery,
  useGetRotationThresholdsQuery,
} from "@/lib/features/rotation/api";
import { useRotationRowActions } from "@/lib/features/rotation/hooks";
import { useRotationBinMove } from "@/lib/features/rotation/useRotationBinMove";
import { useRotationCardActions } from "@/lib/features/rotation/useRotationCardActions";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationCardWithCount,
  type RotationListRow,
  type RotationWindowDays,
} from "@/lib/features/rotation/types";
import { rotationBinColors, rotationBinSx } from "@/lib/features/experiences/modern/tokens/roles";
import ReadRetryAlert from "@/src/components/experiences/modern/admin/ReadRetryAlert";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";
import StatusRegion from "@/src/components/experiences/modern/StatusRegion";
import { useUtcDayClock } from "@/src/hooks/useUtcDayClock";
import { ROW_HEIGHT, recordTableSx, tabularNumsSx } from "@/src/utilities/modern/recordTableSx";
import CardAssignmentPanel from "../CardAssignmentPanel";
import RotationThresholdsForm from "../RotationThresholdsForm";
import ShelfCardHeader from "./ShelfCardHeader";
import ShelfRow from "./ShelfRow";
import { shelfRowName } from "./shelfText";

/**
 * How many killed rows mount per batch. The `status=all` read is unbounded
 * and its killed presentation is the station's whole rotation history —
 * thousands of rows in production — so mounting a row per entry at once is
 * the one unbounded render on this screen. A render cap only: search,
 * filters, and every count still run over the full set.
 */
const KILLED_RENDER_BATCH = 50;

/** Columns in list view: art, album/artist, location, in bin, links, actions. */
const LIST_COLUMNS = 6;
/** By-card view drops the location column: the card header already names it. */
const CARD_COLUMNS = 5;

/** Below this, `stickyHeader` sizes the column-header row; group strips stick just under it. */
const HEADER_ROW_PX = 36;

type ShelfView = "list" | "cards";
type ShelfStatus = "active" | "killed";

function BinStrip({
  bin,
  colSpan,
  count,
  overdue,
  label,
}: {
  bin: RotationBin | null;
  colSpan: number;
  count: number;
  overdue?: number;
  label?: string;
}): JSX.Element {
  const c = bin ? rotationBinColors(bin) : null;
  return (
    <tr className="bin-strip">
      <th
        colSpan={colSpan}
        scope="colgroup"
        style={{
          position: "sticky",
          top: HEADER_ROW_PX,
          zIndex: 4,
          padding: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.75,
            bgcolor: c ? c.bg : "background.level1",
            color: c ? c.text : "text.secondary",
            boxShadow: c ? `inset 4px 0 0 ${c.bgSelected}` : undefined,
            borderBottom: "1px solid",
            borderColor: c ? c.border : "divider",
          }}
        >
          <Typography
            level="body-xs"
            textColor="inherit"
            sx={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "md" }}
          >
            {label ?? (bin ? ROTATION_BIN_LABELS[bin] : "")}
          </Typography>
          <Typography level="body-xs" textColor="inherit" sx={{ opacity: 0.8, ...tabularNumsSx }}>
            {count}
            {overdue ? ` · ${overdue} overdue` : ""}
          </Typography>
        </Box>
      </th>
    </tr>
  );
}

function SkeletonRows({ columns }: { columns: number }): JSX.Element {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i} className="record-row">
          <td style={{ width: 76, paddingRight: 0 }}>
            <Skeleton variant="rectangular" width={52} height={52} sx={{ borderRadius: "sm" }} />
          </td>
          <td>
            <Skeleton variant="text" level="title-sm" width="40%" />
            <Skeleton variant="text" level="body-sm" width="25%" />
          </td>
          {Array.from({ length: columns - 3 }, (_, j) => (
            <td key={j}>
              <Skeleton variant="text" level="body-sm" width="60%" />
            </td>
          ))}
          <td className="actions-cell" />
        </tr>
      ))}
    </>
  );
}

/**
 * The rotation shelf: every record in rotation, grouped by bin, in the card
 * catalog's row anatomy. Two views of the same read — List (by bin) and By
 * card (bin → card, with each card's management in its group header) — so
 * filing order on the physical shelf and the list on screen are one thing.
 *
 * Reads `status=all`, the one read that can show killed rows. Cache sync
 * lives on the endpoints: a row changes presentation without refetching the
 * full rotation history. A cross-bin move is add-then-kill through the shared
 * ordering, because no endpoint edits a bin in place; a card move is the
 * row's `card_id` field, a within-bin move only.
 */
export default function RotationShelf({ now: nowProp }: { now?: Date } = {}): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: ShelfView = searchParams.get("view") === "cards" ? "cards" : "list";
  const windowsOpen = searchParams.get("windows") === "1";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const { data: rows, isFetching, isError, refetch, fulfilledTimeStamp } =
    useGetRotationListQuery("all");
  // Ages are differenced against the moment the rows were read, then roll
  // forward across UTC midnight with no refetch. A caller wanting a fixed
  // clock (tests) passes its own.
  const utcDayClock = useUtcDayClock(fulfilledTimeStamp);
  const now = useMemo(() => nowProp ?? utcDayClock ?? new Date(0), [nowProp, utcDayClock]);
  // A failed cards read must not impair the list: rows still render (each
  // knows its own card); only card menus and the By-card view wait on it.
  const cardsQuery = useGetRotationCardsQuery();
  const cards = cardsQuery.data;
  // `isError` also covers a failed refetch that left the last good record in
  // `data` — a number an MD may have since changed — so it withholds windows.
  const { data: thresholds, isError: thresholdsFailed } = useGetRotationThresholdsQuery();
  const windows: RotationWindowDays | null =
    thresholds != null && !thresholdsFailed ? thresholds.window_days : null;
  const cardStaleDays = thresholds != null && !thresholdsFailed ? thresholds.card_stale_days ?? null : null;

  const { pendingRotationIds, kill, unkill, moveToCard, withPending } = useRotationRowActions();
  const moveRow = useRotationBinMove(rows);
  const cardActions = useRotationCardActions();

  const [search, setSearch] = useState("");
  const [bin, setBin] = useState<RotationBin | null>(null);
  const [sort, setSort] = useState<RotationAdminSort>("oldest");
  const [status, setStatus] = useState<ShelfStatus>("active");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [killedRenderCap, setKilledRenderCap] = useState(KILLED_RENDER_BATCH);
  const [assigningCardId, setAssigningCardId] = useState<number | null>(null);
  const [stillOnFirstCardOnly, setStillOnFirstCardOnly] = useState(false);
  // Most overdue without windows reads as oldest-first, so the Select never
  // holds a value whose Option is not rendered.
  const effectiveSort = sort === "overdue" && windows == null ? "oldest" : sort;
  const shownStatus: ShelfStatus = view === "cards" ? "active" : status;

  const shelf = useMemo(
    () => selectRotationAdminView(rows ?? [], { search, bin, cardId: null, sort: effectiveSort }, windows),
    [rows, search, bin, effectiveSort, windows],
  );
  const overdue = (row: RotationListRow) =>
    windows != null && isPastWindow(row, windows[row.rotation_bin], now);
  // Counted over every active row regardless of filters: an MD narrowing to
  // one bin still needs the list-wide overdue total.
  const totalOverdue = useMemo(
    () =>
      windows == null
        ? 0
        : (rows ?? []).filter(
            (row) => rotationRowPresentation(row) === "active" && isPastWindow(row, windows[row.rotation_bin], now),
          ).length,
    [rows, windows, now],
  );
  const activeShown = overdueOnly ? shelf.active.filter(overdue) : shelf.active;
  const killedShown = shelf.killed.slice(0, killedRenderCap);
  const shownRows = shownStatus === "active" ? activeShown : killedShown;

  const cardsByBin = useMemo(() => groupRotationCardsByBin(cards ?? []), [cards]);
  // A card's last activity: its newest add or kill, so a kill counts as work.
  const lastActivityByCard = useMemo(() => {
    const latest = new Map<number, number>();
    for (const row of rows ?? []) {
      const cardId = row.card?.id;
      if (cardId == null) continue;
      const touched = Math.max(
        isoDateToUTCDays(row.rotation_add_date),
        row.rotation_kill_date ? isoDateToUTCDays(row.rotation_kill_date) : -Infinity,
      );
      latest.set(cardId, Math.max(latest.get(cardId) ?? -Infinity, touched));
    }
    return latest;
  }, [rows]);
  const todayDays = Math.floor(now.getTime() / 86_400_000);

  const assigningCard = cards?.find((card) => card.id === assigningCardId);
  const assignBinCards = assigningCard ? (cardsByBin.get(assigningCard.bin) ?? []) : [];
  const nextAssigningCard = assigningCard
    ? (assignBinCards[assignBinCards.findIndex((c) => c.id === assigningCard.id) + 1] ?? null)
    : null;

  const killWithUndo = async (row: RotationListRow) => {
    const ok = await kill(row.rotation_id);
    if (ok) {
      toast(`Retired ${shelfRowName(row)}.`, {
        action: { label: "Undo", onClick: () => void unkill(row.rotation_id) },
      });
    }
  };

  const rowProps = (row: RotationListRow) => ({
    row,
    binCards: cardsByBin.get(row.rotation_bin) ?? [],
    pending: pendingRotationIds.has(row.rotation_id),
    // Moves stay disabled while the list refetches: the add half invalidates
    // the list, and every row keeps its old bin until that refetch lands — a
    // second move in that window would file a second active entry.
    moveLocked: isFetching,
    now,
    windows,
    onOpen: (albumId: number) => router.push(`/dashboard/album/${albumId}`),
    onKill: () => void killWithUndo(row),
    onUnkill: () => void unkill(row.rotation_id),
    onSelectCard: (cardId: number) => void moveToCard(row.rotation_id, cardId),
    // `moveRow` settles every failure into its own toast; `withPending`'s
    // catch is the backstop, and registers the row as in flight for the move.
    onMoveBin: (target: RotationBin) =>
      void withPending(row.rotation_id, () => moveRow(row, target), "move"),
  });

  // Absence-of-list, not the error flag: a background refetch can leave
  // isError true while the last-good rows are still on screen, and a
  // query-fed list must never render an outage as "there are none".
  if (isError && rows == null) {
    return <ReadRetryAlert message="Could not load the rotation list." onRetry={() => void refetch()} />;
  }

  const loading = rows == null;
  const bins = bin ? [bin] : ROTATION_BINS;
  const columns = view === "cards" ? CARD_COLUMNS : LIST_COLUMNS;
  const statusMessage = loading
    ? "Loading rotation"
    : `${shownRows.length} ${shownStatus} record${shownRows.length === 1 ? "" : "s"}`;
  const filtersOn = search.trim() !== "" || bin != null || overdueOnly;

  const renderList = () => {
    if (shownRows.length === 0) return null;
    return bins.map((b) => {
      const inBin = shownRows.filter((row) => row.rotation_bin === b);
      if (inBin.length === 0) return null;
      return (
        <tbody key={b}>
          <BinStrip
            bin={b}
            colSpan={columns}
            count={inBin.length}
            overdue={shownStatus === "active" ? inBin.filter(overdue).length : 0}
          />
          {inBin.map((row) => (
            <ShelfRow key={row.rotation_id} {...rowProps(row)} />
          ))}
        </tbody>
      );
    });
  };

  const renderByCard = () => {
    // The cards are what this view is made of: until they are known it shows
    // placeholders, and an outage shows only the retry — never empty bins.
    if (cards == null) {
      return (
        <tbody>
          {cardsQuery.isError ? (
            <tr>
              <td colSpan={columns}>
                <ReadRetryAlert
                  message="Could not load the rotation cards."
                  onRetry={() => void cardsQuery.refetch()}
                />
              </td>
            </tr>
          ) : (
            <SkeletonRows columns={columns} />
          )}
        </tbody>
      );
    }
    return bins.map((b) => {
      const binCards: RotationCardWithCount[] = cardsByBin.get(b) ?? [];
      const inBin = activeShown.filter((row) => row.rotation_bin === b);
      const uncarded = inBin.filter((row) => row.card?.id == null || !binCards.some((c) => c.id === row.card?.id));
      return (
        <tbody key={b}>
          <BinStrip
            bin={b}
            colSpan={columns}
            count={inBin.length}
            overdue={inBin.filter(overdue).length}
            label={`${ROTATION_BIN_LABELS[b]} · ${binCards.length} card${binCards.length === 1 ? "" : "s"}`}
          />
          {binCards.map((card) => {
            const onCard = inBin.filter((row) => row.card?.id === card.id);
            const touched = lastActivityByCard.get(card.id);
            const lastActivityDays = touched == null ? null : Math.max(0, todayDays - touched);
            return (
              <Fragment key={card.id}>
                <ShelfCardHeader
                  card={card}
                  bin={b}
                  colSpan={columns}
                  lastActivityDays={lastActivityDays}
                  stale={cardStaleDays != null && lastActivityDays != null && lastActivityDays > cardStaleDays}
                  deletable={canDeleteRotationCard(card, binCards)}
                  pending={cardActions.pendingCardIds.has(card.id)}
                  onRename={(name) => cardActions.renameCard(card.id, name)}
                  onDelete={() => cardActions.deleteCard(card.id)}
                  onAssign={() => {
                    setAssigningCardId(card.id);
                    setStillOnFirstCardOnly(false);
                  }}
                />
                {onCard.map((row) => (
                  <ShelfRow key={row.rotation_id} {...rowProps(row)} showLocation={false} />
                ))}
                {onCard.length === 0 && (
                  <tr>
                    <td colSpan={columns}>
                      <Typography level="body-xs" textColor="text.tertiary" sx={{ pl: 1 }}>
                        {card.active_count === 0 ? "Nothing on this card yet." : "No matches on this card."}
                      </Typography>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {uncarded.length > 0 && (
            <>
              <tr className="card-header">
                <th colSpan={columns} scope="colgroup">
                  <Typography level="title-sm" textColor="text.tertiary">
                    No card
                  </Typography>
                </th>
              </tr>
              {uncarded.map((row) => (
                <ShelfRow key={row.rotation_id} {...rowProps(row)} showLocation={false} />
              ))}
            </>
          )}
          <tr>
            <td colSpan={columns}>
              <Button
                size="sm"
                variant="plain"
                color="neutral"
                startDecorator={<Add fontSize="small" />}
                aria-label={`Add a card to ${ROTATION_BIN_LABELS[b]}`}
                // Every bin's affordance waits, not just the clicked one: the
                // number the toast echoes is the server's assignment, and two
                // concurrent creates would race for it.
                disabled={cardActions.pendingAddBin != null}
                loading={cardActions.pendingAddBin === b}
                onClick={() => cardActions.addCard(b)}
              >
                Add card to {ROTATION_BIN_LABELS[b]}
              </Button>
            </td>
          </tr>
        </tbody>
      );
    });
  };

  return (
    // Fills the page below the header; the table scrolls inside its sheet, so
    // the toolbar stays put and the bin strips stick under the column header.
    <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
      <StatusRegion message={statusMessage} />

      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Input
          size="sm"
          type="search"
          placeholder="Search artist, title, or code…"
          aria-label="Search rotation"
          startDecorator={<Search fontSize="small" />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ width: 260 }}
        />
        <Chip
          size="sm"
          variant={bin === null ? "solid" : "outlined"}
          color="neutral"
          onClick={() => setBin(null)}
          slotProps={{ action: { "aria-pressed": bin === null } }}
          sx={tabularNumsSx}
        >
          All {shelf.searchedActiveCount}
        </Chip>
        {ROTATION_BINS.map((candidate) => (
          <Chip
            key={candidate}
            size="sm"
            onClick={() => setBin(bin === candidate ? null : candidate)}
            slotProps={{
              action: {
                "aria-pressed": bin === candidate,
                "aria-label": `${ROTATION_BIN_LABELS[candidate]} (${shelf.binCounts.get(candidate) ?? 0})`,
              },
            }}
            sx={{ ...rotationBinSx(candidate, bin === candidate ? "solid" : "soft"), ...tabularNumsSx }}
          >
            {candidate} {shelf.binCounts.get(candidate) ?? 0}
          </Chip>
        ))}
        {windows != null && (
          <Chip
            size="sm"
            variant={overdueOnly ? "solid" : "soft"}
            color="warning"
            startDecorator={<TimerOutlined sx={{ fontSize: 14 }} />}
            onClick={() => setOverdueOnly((on) => !on)}
            slotProps={{ action: { "aria-pressed": overdueOnly } }}
            data-testid="rotation-admin-overdue-count"
            sx={tabularNumsSx}
          >
            Overdue {totalOverdue}
          </Chip>
        )}
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          startDecorator={<TuneOutlined fontSize="small" />}
          onClick={() => setParam("windows", "1")}
        >
          Windows
        </Button>
        <Select
          size="sm"
          value={effectiveSort}
          onChange={(_event, next) => {
            if (next != null) setSort(next);
          }}
          slotProps={{ button: { "aria-label": "Sort rotation" } }}
          sx={{ minWidth: 150 }}
        >
          <Option value="oldest">Oldest first</Option>
          <Option value="newest">Newest first</Option>
          {windows != null && <Option value="overdue">Most overdue</Option>}
        </Select>
        <Box sx={{ flex: 1 }} />
        {view === "list" && (
          <ToggleButtonGroup
            size="sm"
            value={status}
            onChange={(_event, next) => next && setStatus(next as ShelfStatus)}
            aria-label="Records shown"
          >
            <Button value="active">Active {shelf.activeTotal}</Button>
            <Button value="killed">Retired {shelf.killedTotal}</Button>
          </ToggleButtonGroup>
        )}
        <ToggleButtonGroup
          size="sm"
          value={view}
          onChange={(_event, next) => next && setParam("view", next === "cards" ? "cards" : null)}
          aria-label="Shelf view"
        >
          <Button value="list">List</Button>
          <Button value="cards">By card</Button>
        </ToggleButtonGroup>
      </Stack>

      <Sheet variant="outlined" sx={{ borderRadius: "md", flex: 1, minHeight: 0, overflow: "auto" }}>
        <Table
          stickyHeader
          hoverRow
          aria-label="Rotation shelf"
          aria-busy={loading || isFetching}
          sx={{
            ...recordTableSx(ROW_HEIGHT.mediaTall),
            "--TableCell-height": `${HEADER_ROW_PX}px`,
            "& thead th": { height: HEADER_ROW_PX, zIndex: 5 },
            "& tbody tr.card-header > th": {
              bgcolor: "background.surface",
              borderBottom: "1px solid",
              borderColor: "divider",
              py: 0.75,
            },
            "& .col-links": { display: { xs: "none", md: "table-cell" } },
          }}
        >
          <thead>
            <tr>
              <th style={{ width: 76 }} aria-label="Artwork" />
              <th>Album / Artist</th>
              {view === "list" && <th style={{ width: 120 }}>Location</th>}
              <th style={{ width: 110, textAlign: "right" }}>
                {shownStatus === "killed" ? "Retired" : "In bin"}
              </th>
              <th style={{ width: 56, textAlign: "right" }} aria-label="Links" />
              <th aria-label="Actions" style={{ width: 0, padding: 0 }} />
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <SkeletonRows columns={columns} />
            </tbody>
          ) : view === "cards" ? (
            renderByCard()
          ) : (
            renderList()
          )}
        </Table>
        {!loading && view === "list" && shownRows.length === 0 && (
          <Stack spacing={1} alignItems="center" sx={{ py: 5 }}>
            <Typography level="body-md" textColor="text.secondary">
              {filtersOn
                ? "Nothing on this shelf matches."
                : shownStatus === "killed"
                  ? "Nothing has been retired from rotation yet."
                  : "The rotation shelf is empty."}
            </Typography>
            {filtersOn ? (
              <Button
                size="sm"
                variant="plain"
                onClick={() => {
                  setSearch("");
                  setBin(null);
                  setOverdueOnly(false);
                }}
              >
                Clear filters
              </Button>
            ) : (
              shownStatus === "active" && (
                <Button size="sm" variant="plain" onClick={() => router.push("/dashboard/admin/rotation/new")}>
                  File a record into rotation
                </Button>
              )
            )}
          </Stack>
        )}
        {shownStatus === "killed" && shelf.killed.length > killedRenderCap && (
          <Button
            variant="outlined"
            color="neutral"
            size="sm"
            sx={{ display: "flex", mx: "auto", my: 1.5 }}
            onClick={() => setKilledRenderCap((cap) => cap + KILLED_RENDER_BATCH)}
          >
            Show {Math.min(KILLED_RENDER_BATCH, shelf.killed.length - killedRenderCap)} more
          </Button>
        )}

      </Sheet>

      <ConfirmDialog
        open={windowsOpen}
        onClose={() => setParam("windows", null)}
        role="dialog"
        title="Replacement windows"
        sx={{ width: 460, maxWidth: "100%" }}
        actions={<></>}
      >
        <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 1.5 }}>
          How long a record stays in its bin before it shows as overdue.
        </Typography>
        <RotationThresholdsForm
          rows={rows ?? null}
          now={now}
          onSaved={() => setParam("windows", null)}
          actions={(save) => (
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 1 }}>
              <Button variant="plain" color="neutral" onClick={() => setParam("windows", null)}>
                Cancel
              </Button>
              {save}
            </Stack>
          )}
        />
      </ConfirmDialog>

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
    </Stack>
  );
}

