import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeRotationAdminEndpoints } from "@/tests/fakes/rotation";
import { server } from "@/tests/fakes/server";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { rotationRowCode } from "@/lib/features/rotation/adminList";
import { rotationApi } from "@/lib/features/rotation/api";
import type { RotationListRow } from "@/lib/features/rotation/types";
import { createTestRotationListRow } from "@/tests/fixtures/fixtures";
import type { RotationCard } from "@wxyc/shared";

vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

import { renderWithModernTheme as renderWithProviders } from "@/tests/helpers/renderModern";
import CardAssignmentPanel, {
  type CardAssignmentPanelProps,
} from "@/src/components/experiences/modern/admin/rotation/CardAssignmentPanel";

// Owns the "Still on <Bin> 1" toggle the way `CardsManager` does, so these
// specs exercise the panel as the controlled component it now is. Its own
// persistence through Save & open, and its reset on close and reopen, are
// `CardsManager`'s to prove.
function TestCardAssignmentPanel(
  props: Omit<CardAssignmentPanelProps, "stillOnFirstCardOnly" | "setStillOnFirstCardOnly">,
) {
  const [stillOnFirstCardOnly, setStillOnFirstCardOnly] = useState(false);
  return (
    <CardAssignmentPanel
      {...props}
      stillOnFirstCardOnly={stillOnFirstCardOnly}
      setStillOnFirstCardOnly={setStillOnFirstCardOnly}
    />
  );
}

const CARD = { id: 13, bin: "H", number: 3, name: "September" } as const;
const OTHER_CARD = { id: 11, bin: "H", number: 1, name: null } as const;
// The fake's "today". A kill dated after it is still active -- the panel's
// meaning of "active", wider than the Rotation list's -- and one dated on it
// is not.
const TODAY = "2026-09-20";
const KILLED_TODAY = 908;
const OTHER_BIN = 950;

// Every row but 901's has its shelf-code fields nulled out here -- their
// `id` stays the factory's non-null default, so only the code is missing,
// not the catalog link. One coded row is enough to exercise the shelf-code
// search case, and leaving the rest uncoded keeps that search from also
// matching them by accident.
const UNCODED = { code_letters: null, code_artist_number: null, code_number: null } as const;

const ROWS: RotationListRow[] = (
  [
    [
      900,
      { artist_name: "Jessica Pratt", album_title: "On Your Own Love Again", card: CARD,
        rotation_add_date: "2026-09-08", ...UNCODED },
    ],
    [
      901,
      // The only coded row (see UNCODED above) -- carries Juana Molina's own
      // shelf code, not the factory's Stereolab default, so the shelf-code
      // search case below exercises a code consistent with its own artist.
      { artist_name: "Juana Molina", album_title: "DOGA", card: OTHER_CARD,
        rotation_add_date: "2026-09-18", code_letters: "RO", code_artist_number: 42,
        code_number: 1 },
    ],
    [
      902,
      { artist_name: "Chuquimamani-Condori", album_title: "Edits", card: OTHER_CARD,
        rotation_add_date: "2026-09-05", ...UNCODED },
    ],
    [
      903,
      { artist_name: "Duke Ellington & John Coltrane",
        album_title: "Duke Ellington & John Coltrane", card: OTHER_CARD,
        rotation_add_date: "2026-09-20", ...UNCODED },
    ],
    [
      904,
      { artist_name: "Stereolab", album_title: "Dots and Loops", card: OTHER_CARD,
        rotation_add_date: "2026-09-12", ...UNCODED },
    ],
    [
      905,
      { artist_name: "Nilüfer Yanya", album_title: "PAINLESS", card: OTHER_CARD,
        rotation_add_date: "2026-09-25", ...UNCODED },
    ],
    [
      906,
      { artist_name: "Hermanos Gutiérrez", album_title: "El Bueno y el Malo", card: OTHER_CARD,
        rotation_add_date: "2026-09-02", ...UNCODED },
    ],
    [
      907,
      { artist_name: "Jessica Pratt", album_title: "Here in the Pitch", card: OTHER_CARD,
        rotation_add_date: "2026-09-15", rotation_kill_date: "2026-09-25", ...UNCODED },
    ],
    [
      KILLED_TODAY,
      { artist_name: "Stereolab", album_title: "Emperor Tomato Ketchup", card: OTHER_CARD,
        rotation_add_date: "2026-09-03", rotation_kill_date: TODAY, ...UNCODED },
    ],
  ] as const
).map(([rotation_id, overrides]) => createTestRotationListRow({ rotation_id, ...overrides }));
ROWS.push(
  createTestRotationListRow({
    rotation_id: OTHER_BIN,
    rotation_bin: "M",
    card: null,
    artist_name: "Cat Power",
    album_title: "Moon Pix",
    rotation_add_date: "2026-09-06",
    ...UNCODED,
  }),
);

const LIST_URL = `${TEST_BACKEND_URL}/library/rotation`;

const title = (rotationId: number) => {
  const row = ROWS.find((candidate) => candidate.rotation_id === rotationId);
  return `${row?.artist_name} — ${row?.album_title}`;
};
const box = (rotationId: number) => screen.getByRole("checkbox", { name: title(rotationId) });
const button = (name: string) => screen.getByRole("button", { name });
const patchedIds = (fake: ReturnType<typeof fakeRotationAdminEndpoints>) =>
  fake.updateBodies().map((update) => update.id);

const failedListRead = () => HttpResponse.json({ message: "boom" }, { status: 500 });
// Escape reaches the dialog's own handler only from inside its modal, so a
// case about Escape first shows that is where focus is.
const focusIsInModal = () =>
  screen.getByRole("dialog").closest(".MuiModal-root")?.contains(document.activeElement);
const backdrop = () => document.querySelector(".MuiModal-backdrop") as HTMLElement;

// `firstRead` holds or fails the read the panel opens with; either leaves
// the case to say what the panel shows instead of its lists.
async function renderPanel({
  gateCardMoves = false,
  firstRead = "answered",
  next,
}: {
  gateCardMoves?: boolean;
  firstRead?: "answered" | "held" | "failed";
  next?: { card: RotationCard; open: () => void };
} = {}) {
  const fake = fakeRotationAdminEndpoints(ROWS, [CARD, OTHER_CARD], {
    today: TODAY,
    gateCardMoves,
  });
  if (firstRead === "held") fake.holdActiveListReads();
  // Registered after the fake, so it answers first, once; the fake's own
  // list arm answers every read after it.
  if (firstRead === "failed") server.use(http.get(LIST_URL, failedListRead, { once: true }));
  const onClose = vi.fn();
  const rendered = renderWithProviders(
    <TestCardAssignmentPanel card={CARD} next={next} onClose={onClose} />,
  );
  if (firstRead === "answered") await screen.findByText("On Heavy 3 now · 1");
  return {
    fake,
    onClose,
    // A released response settles into panel state, so the wait runs in `act`.
    releaseMove: (id: number) => act(() => fake.releaseCardMoveOnceRequested(id)),
    releaseList: () => act(() => fake.releaseActiveListReads()),
    ...rendered,
  };
}

async function tick(user: ReturnType<typeof renderWithProviders>["user"], ids: number[]) {
  for (const id of ids) await user.click(box(id));
}

describe("CardAssignmentPanel", () => {
  it("shows the bin's active records, members checked and locked, others showing their card", async () => {
    const { fake } = await renderPanel();

    expect(screen.getByRole("dialog", { name: "Heavy 3" })).toBeInTheDocument();
    expect(box(900)).toBeChecked();
    expect(box(900)).toBeDisabled();
    expect(box(900)).toHaveAccessibleDescription("On Heavy 3");

    // 901-906, and 907: a kill dated after today is still active.
    expect(screen.getByText("Elsewhere in Heavy · 7")).toBeInTheDocument();
    expect(box(907)).toBeEnabled();
    // A kill that has arrived is not on any card, and another bin's record
    // is not this card's to take.
    expect(screen.queryByText(title(KILLED_TODAY))).not.toBeInTheDocument();
    expect(screen.queryByText(title(OTHER_BIN))).not.toBeInTheDocument();

    expect(box(901)).not.toBeChecked();
    expect(box(901)).toBeEnabled();
    expect(box(901)).toHaveAccessibleDescription("Heavy 1");
    expect(fake.listStatuses()).toEqual(["active"]);
  });

  it("lists the elsewhere records by card then artist, through base-sensitivity collation", async () => {
    // ROWS's own elsewhere names never diverge from their raw-code-unit
    // order, so that fixture would pass this even with collation ripped out.
    // Aşıq Altay vs Autechre does diverge: compared at base sensitivity, "ş"
    // is its base letter "s", so Aşıq Altay sorts ahead of Autechre on their
    // second letter (s before u). Compared by raw code unit instead, the
    // accented ş (U+015F) outranks every plain ASCII letter and would put
    // Autechre first.
    const orderingRows: RotationListRow[] = (
      [
        [970, { artist_name: "Autechre", album_title: "Elseq 1-5", card: OTHER_CARD,
          rotation_add_date: "2026-09-10" }],
        [971, { artist_name: "Aşıq Altay", album_title: "Dolu Kaval", card: OTHER_CARD,
          rotation_add_date: "2026-09-11" }],
        [972, { artist_name: "Hermanos Gutiérrez", album_title: "El Bueno y el Malo",
          card: OTHER_CARD, rotation_add_date: "2026-09-12" }],
      ] as const
    ).map(([rotation_id, overrides]) => createTestRotationListRow({ rotation_id, ...overrides }));
    fakeRotationAdminEndpoints(orderingRows, [CARD, OTHER_CARD], { today: TODAY });
    renderWithProviders(<TestCardAssignmentPanel card={CARD} onClose={vi.fn()} />);
    await screen.findByText("On Heavy 3 now · 0");
    const orderingTitle = (rotationId: number) => {
      const row = orderingRows.find((candidate) => candidate.rotation_id === rotationId);
      return `${row?.artist_name} — ${row?.album_title}`;
    };

    const order = [971, 970, 972].map((id) =>
      screen.getByRole("checkbox", { name: orderingTitle(id) }),
    );
    for (let i = 0; i + 1 < order.length; i += 1) {
      expect(order[i].compareDocumentPosition(order[i + 1])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it("narrows the elsewhere list by a shelf code", async () => {
    const { user } = await renderPanel();
    const coded = ROWS.flatMap((row) => {
      const code = rotationRowCode(row);
      return code == null ? [] : [{ row, code }];
    })[0];
    if (coded == null) throw new Error("fixture has no coded row to search by");

    await user.type(screen.getByRole("searchbox", { name: "Search Heavy" }), coded.code);

    expect(screen.getByText("Elsewhere in Heavy · 1")).toBeInTheDocument();
    expect(box(coded.row.rotation_id)).toBeInTheDocument();
  });

  it("ticks a record from its label text and previews the move", async () => {
    const { user } = await renderPanel();

    await user.click(screen.getByText(title(901)));

    expect(box(901)).toBeChecked();
    expect(box(901)).toHaveAccessibleDescription("Heavy 1 → Heavy 3");
    expect(button("Save 1")).toBeEnabled();
  });

  it("shows a read still loading as loading, never as a bin with no records", async () => {
    const { releaseList, onClose, user } = await renderPanel({ firstRead: "held" });

    expect(await screen.findByRole("progressbar", { name: "Loading rotation" })).toBeInTheDocument();
    expect(screen.queryByText(/On Heavy 3 now/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Elsewhere in Heavy/)).not.toBeInTheDocument();
    expect(button("Save")).toBeDisabled();
    // Nothing is being written, so the panel can still be left.
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await releaseList();
    expect(await screen.findByText("On Heavy 3 now · 1")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a failed read as an error with Retry, never as a bin with no records", async () => {
    const { fake, user } = await renderPanel({ firstRead: "failed" });

    expect(await screen.findByText("Could not load the rotation list.")).toBeInTheDocument();
    expect(screen.queryByText(/On Heavy 3 now/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Elsewhere in Heavy/)).not.toBeInTheDocument();
    expect(button("Save")).toBeDisabled();

    await user.click(button("Retry"));

    expect(await screen.findByText("On Heavy 3 now · 1")).toBeInTheDocument();
    expect(screen.queryByText("Could not load the rotation list.")).not.toBeInTheDocument();
    // The retry is the one read the fake saw, and it is the bounded facet.
    expect(fake.listStatuses()).toEqual(["active"]);
  });

  it("saves exactly the newly ticked records onto the card, never reading the unbounded history", async () => {
    const { fake, user } = await renderPanel();

    await tick(user, [901, 902]);
    await user.click(button("Save 2"));

    expect(await screen.findByText("On Heavy 3 now · 3")).toBeInTheDocument();
    expect(fake.updateBodies()).toEqual([
      { id: 901, body: { card_id: CARD.id } },
      { id: 902, body: { card_id: CARD.id } },
    ]);
    // The first read and the one refetch, both the bounded facet.
    expect(fake.listStatuses()).toEqual(["active", "active"]);
  });

  it("shows live progress while a save runs and cannot be closed until it ends", async () => {
    const { releaseMove, onClose, user } = await renderPanel({ gateCardMoves: true });

    await tick(user, [901, 902]);
    await user.click(button("Save 2"));

    expect(await screen.findByRole("status")).toHaveTextContent("Moving 0 of 2 to Heavy 3");
    expect(button("Close")).toBeDisabled();
    expect(focusIsInModal()).toBe(true);
    await user.keyboard("{Escape}");
    await user.click(backdrop());
    expect(onClose).not.toHaveBeenCalled();

    await releaseMove(901);
    // The line is already on screen at 0 of 2, so the count is waited for.
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Moving 1 of 2 to Heavy 3"),
    );
    await releaseMove(902);

    await waitFor(() => expect(button("Close")).toBeEnabled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes an idle panel on Escape and on a backdrop click", async () => {
    const { onClose, user } = await renderPanel();
    expect(focusIsInModal()).toBe(true);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(backdrop());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps a record just moved locked, and Save disabled, until the refetched list shows it on the card", async () => {
    const { fake, releaseList, user } = await renderPanel();
    fake.holdActiveListReads();

    await tick(user, [901]);
    await user.click(button("Save 1"));

    // The write has landed and the save is over; only the refetch is out.
    await waitFor(() => expect(box(901)).toHaveAccessibleDescription("Moved to Heavy 3"));
    await waitFor(() => expect(button("Close")).toBeEnabled());
    expect(screen.getByText("Elsewhere in Heavy · 7")).toBeInTheDocument();
    expect(box(901)).toBeChecked();
    expect(box(901)).toBeDisabled();
    // The list on screen predates the save, so nothing on it is tickable.
    expect(box(902)).toBeDisabled();
    expect(button("Save")).toBeDisabled();

    await releaseList();

    expect(await screen.findByText("On Heavy 3 now · 2")).toBeInTheDocument();
    expect(box(901)).toHaveAccessibleDescription("On Heavy 3");
    expect(box(901)).toBeDisabled();
    expect(box(902)).toBeEnabled();
  });

  it("keeps moved records locked when the refetch after a save fails, and never counts or resends them after a later save", async () => {
    const { fake, user } = await renderPanel();
    server.use(http.get(LIST_URL, failedListRead));
    // The list as it was first read: what a read that predates every save
    // here answers with.
    const stale = ROWS.filter((row) => row.rotation_id !== KILLED_TODAY);
    const retryReadAnsweredStale = async () => {
      server.use(http.get(LIST_URL, () => HttpResponse.json(stale), { once: true }));
      await user.click(button("Retry"));
    };

    await tick(user, [901, 902]);
    await user.click(button("Save 2"));

    expect(await screen.findByText("Could not load the rotation list.")).toBeInTheDocument();
    for (const id of [901, 902]) {
      expect(box(id)).toBeChecked();
      expect(box(id)).toBeDisabled();
      expect(box(id)).toHaveAccessibleDescription("Moved to Heavy 3");
    }
    // A list that could not be refreshed gates nothing open.
    expect(box(903)).toBeDisabled();
    expect(button("Save")).toBeDisabled();

    // The retried read succeeds but still predates the save: the panel
    // unlocks, and the moved records stay locked on their own.
    await retryReadAnsweredStale();

    await waitFor(() => expect(box(903)).toBeEnabled());
    expect(screen.queryByText("Could not load the rotation list.")).not.toBeInTheDocument();
    for (const id of [901, 902]) {
      expect(box(id)).toBeChecked();
      expect(box(id)).toBeDisabled();
      expect(box(id)).toHaveAccessibleDescription("Moved to Heavy 3");
    }

    await tick(user, [903]);
    await user.click(button("Save 1"));

    await waitFor(() => expect(patchedIds(fake)).toEqual([901, 902, 903]));

    // That save's refetch fails too, and its retry is as stale as the last.
    // The row lock now belongs to 903, the latest save's record. 901 and 902
    // have lost it, so they must not still be ticked: a tick nobody made
    // would be counted by Save and sent again.
    expect(await screen.findByText("Could not load the rotation list.")).toBeInTheDocument();
    await retryReadAnsweredStale();

    await waitFor(() => expect(box(904)).toBeEnabled());
    expect(box(903)).toBeDisabled();
    expect(box(903)).toHaveAccessibleDescription("Moved to Heavy 3");
    for (const id of [901, 902]) {
      expect(box(id)).not.toBeChecked();
      expect(box(id)).toHaveAccessibleDescription("Heavy 1");
    }
    expect(button("Save")).toBeDisabled();

    await tick(user, [904]);
    await user.click(button("Save 1"));

    await waitFor(() => expect(patchedIds(fake)).toEqual([901, 902, 903, 904]));
  });

  it("shows a partial failure distinctly, and Retry resends only the failed record", async () => {
    const { fake, user } = await renderPanel();
    fake.failCardMove([902]);

    await tick(user, [901, 902]);
    await user.click(button("Save 2"));

    // Enabled only once the refetch has landed and 901 reads as on the card.
    await waitFor(() => expect(button("Retry 1")).toBeEnabled());
    expect(box(901)).toHaveAccessibleDescription("On Heavy 3");
    expect(box(902)).toHaveAccessibleDescription("refused");
    expect(box(902)).toBeChecked();

    fake.failCardMove([]);
    await user.click(button("Retry 1"));

    expect(await screen.findByText("On Heavy 3 now · 3")).toBeInTheDocument();
    expect(box(902)).toBeDisabled();
    expect(patchedIds(fake)).toEqual([901, 902, 902]);
    // A batch with a failure also invalidates the full-history read; the
    // panel holds no subscription to it, so it is still never requested.
    expect(fake.listStatuses()).toEqual(["active", "active", "active"]);
  });

  // The hook's own `retry()` has no way to narrow its resend, so unticking a
  // failed record must fall through to a fresh `save` rather than calling
  // it -- otherwise a record a librarian just decided does not belong here
  // would still get sent.
  it("sends a fresh save, not a blanket retry, once a failed record is unticked", async () => {
    const { fake, user } = await renderPanel();
    fake.failCardMove([901, 902]);

    await tick(user, [901, 902]);
    await user.click(button("Save 2"));
    await waitFor(() => expect(button("Retry 2")).toBeEnabled());

    fake.failCardMove([]);
    await tick(user, [902]);
    await user.click(button("Save 1"));

    expect(await screen.findByText("On Heavy 3 now · 2")).toBeInTheDocument();
    expect(patchedIds(fake)).toEqual([901, 902, 901]);
    expect(box(902)).not.toBeChecked();
  });

  // Swapping one failed record for an untried one leaves as many ticked as
  // failed, so a count alone would read this as a retry and resend the
  // record just unticked instead of the one just ticked.
  it("sends a fresh save of exactly the ticked records when a failed one is swapped for another", async () => {
    const { fake, user } = await renderPanel();
    fake.failCardMove([901, 902]);

    await tick(user, [901, 902]);
    await user.click(button("Save 2"));
    await waitFor(() => expect(button("Retry 2")).toBeEnabled());

    fake.failCardMove([]);
    await tick(user, [902, 903]);
    await user.click(button("Save 2"));

    expect(await screen.findByText("On Heavy 3 now · 3")).toBeInTheDocument();
    expect(patchedIds(fake)).toEqual([901, 902, 901, 903]);
    expect(box(902)).not.toBeChecked();
  });

  it("shows moved, failed and not-attempted records distinctly after a stopped batch, with one Retry resending the last two", async () => {
    const { fake, releaseMove, releaseList, user } = await renderPanel({ gateCardMoves: true });
    fake.holdActiveListReads();
    fake.failCardMove([902, 903, 904]);

    await tick(user, [901, 902, 903, 904, 905, 906]);
    await user.click(button("Save 6"));
    expect(await screen.findByRole("status")).toHaveTextContent("Moving 0 of 6 to Heavy 3");
    for (const id of [901, 902, 903, 904]) await releaseMove(id);

    // Three refusals in a row stop the batch at 4 of 6. That is a finished
    // save, not one still in flight: the progress line goes.
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(patchedIds(fake)).toEqual([901, 902, 903, 904]);
    expect(box(901)).toHaveAccessibleDescription("Moved to Heavy 3");
    for (const id of [902, 903, 904]) expect(box(id)).toHaveAccessibleDescription("refused");
    for (const id of [905, 906]) {
      expect(box(id)).toHaveAccessibleDescription("Not attempted — still on Heavy 1");
    }
    // One control for both kinds, so its label names neither.
    expect(button("Retry 5")).toBeDisabled();

    await releaseList();
    await waitFor(() => expect(button("Retry 5")).toBeEnabled());
    expect(screen.getByText("On Heavy 3 now · 2")).toBeInTheDocument();

    fake.failCardMove([]);
    await user.click(button("Retry 5"));

    // The count restarts for the retry, and the records never sent go first.
    expect(await screen.findByRole("status")).toHaveTextContent("Moving 0 of 5 to Heavy 3");
    await waitFor(() => expect(patchedIds(fake).slice(4)).toEqual([905]));
    for (const id of [905, 906, 902, 903, 904]) await releaseMove(id);

    expect(await screen.findByText("On Heavy 3 now · 7")).toBeInTheDocument();
    expect(patchedIds(fake)).toEqual([901, 902, 903, 904, 905, 906, 902, 903, 904]);
    expect(button("Save")).toBeDisabled();
  });

  // ROWS files every elsewhere record on OTHER_CARD, Heavy 1 -- too uniform
  // to prove the filter actually narrows -- so these cases use their own
  // fixture with a second elsewhere card.
  describe("the 'Still on <Bin> 1' filter and search", () => {
    const CARD_2 = { id: 12, bin: "H", number: 2, name: null } as const;
    const LOCAL_ROWS: RotationListRow[] = (
      [
        [801, { artist_name: "Juana Molina", album_title: "DOGA", card: OTHER_CARD,
          rotation_add_date: "2026-09-10" }],
        [802, { artist_name: "Nilüfer Yanya", album_title: "PAINLESS", card: OTHER_CARD,
          rotation_add_date: "2026-09-12" }],
        [803, { artist_name: "Stereolab", album_title: "Dots and Loops", card: CARD_2,
          rotation_add_date: "2026-09-14" }],
      ] as const
    ).map(([rotation_id, overrides]) => createTestRotationListRow({ rotation_id, ...overrides }));
    const localTitle = (rotationId: number) => {
      const row = LOCAL_ROWS.find((candidate) => candidate.rotation_id === rotationId);
      return `${row?.artist_name} — ${row?.album_title}`;
    };
    const localBox = (rotationId: number) =>
      screen.getByRole("checkbox", { name: localTitle(rotationId) });

    async function renderLocalPanel() {
      const fake = fakeRotationAdminEndpoints(LOCAL_ROWS, [CARD, OTHER_CARD, CARD_2], {
        today: TODAY,
      });
      const rendered = renderWithProviders(<TestCardAssignmentPanel card={CARD} onClose={vi.fn()} />);
      await screen.findByText("On Heavy 3 now · 0");
      return { fake, ...rendered };
    }

    it("is absent when the open card is card 1", async () => {
      const fake = fakeRotationAdminEndpoints(LOCAL_ROWS, [CARD, OTHER_CARD, CARD_2], {
        today: TODAY,
      });
      renderWithProviders(<TestCardAssignmentPanel card={OTHER_CARD} onClose={vi.fn()} />);
      await screen.findByText(/^On Heavy 1 now/);

      expect(screen.queryByRole("checkbox", { name: "Still on Heavy 1" })).not.toBeInTheDocument();
      expect(fake.listStatuses()).toEqual(["active"]);
    });

    it("narrows the elsewhere list to the bin's card-1 rows", async () => {
      const { user } = await renderLocalPanel();
      expect(screen.getByText("Elsewhere in Heavy · 3")).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: "Still on Heavy 1" }));

      expect(screen.getByText("Still on Heavy 1 · 2")).toBeInTheDocument();
      expect(localBox(801)).toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: localTitle(803) })).not.toBeInTheDocument();
    });

    it("narrows by artist, diacritic-insensitively", async () => {
      const { user } = await renderLocalPanel();

      await user.type(screen.getByRole("searchbox", { name: "Search Heavy" }), "nilufer");

      expect(screen.getByText("Elsewhere in Heavy · 1")).toBeInTheDocument();
      expect(localBox(802)).toBeInTheDocument();
    });

    it("narrows by title", async () => {
      const { user } = await renderLocalPanel();

      await user.type(screen.getByRole("searchbox", { name: "Search Heavy" }), "doga");

      expect(screen.getByText("Elsewhere in Heavy · 1")).toBeInTheDocument();
      expect(localBox(801)).toBeInTheDocument();
    });

    it("still saves a record ticked and then filtered out of view", async () => {
      const { user, fake } = await renderLocalPanel();
      await user.click(localBox(803));

      await user.click(screen.getByRole("checkbox", { name: "Still on Heavy 1" }));
      expect(screen.queryByRole("checkbox", { name: localTitle(803) })).not.toBeInTheDocument();
      // The toggle hid it from view, same as a search would -- the label
      // says so.
      expect(button("Save 1 (1 hidden)")).toBeEnabled();

      await user.click(button("Save 1 (1 hidden)"));

      expect(await screen.findByText("On Heavy 3 now · 1")).toBeInTheDocument();
      expect(fake.updateBodies()).toEqual([{ id: 803, body: { card_id: CARD.id } }]);
    });
  });

  // Needs its own fixture: ROWS seats only one member on the open card, too
  // few to prove an order.
  describe("the order of a card's own records", () => {
    const HERE_ROWS: RotationListRow[] = (
      [
        [930, { artist_name: "Hermanos Gutiérrez", album_title: "El Bueno y el Malo", card: CARD,
          rotation_add_date: "2026-09-02" }],
        [931, { artist_name: "Nilüfer Yanya", album_title: "PAINLESS", card: CARD,
          rotation_add_date: "2026-09-19" }],
        [932, { artist_name: "Stereolab", album_title: "Instant Holograms on Metal Film", card: CARD,
          rotation_add_date: "2026-09-10" }],
        // Diverge at the second letter: compared at base sensitivity, "ş" is
        // its base letter "s", so "Aşıq Altay" sorts ahead of "Autechre" (s
        // before u). Compared by raw code unit instead, the accented ş
        // (U+015F) outranks every plain ASCII letter and would reverse these.
        [933, { artist_name: "Aşıq Altay", album_title: "Dolu Kaval", card: CARD,
          rotation_add_date: "2026-09-13" }],
        [934, { artist_name: "Autechre", album_title: "Elseq 1-5", card: CARD,
          rotation_add_date: "2026-09-14" }],
      ] as const
    ).map(([rotation_id, overrides]) => createTestRotationListRow({ rotation_id, ...overrides }));
    const hereTitle = (rotationId: number) => {
      const row = HERE_ROWS.find((candidate) => candidate.rotation_id === rotationId);
      return `${row?.artist_name} — ${row?.album_title}`;
    };
    const hereBox = (rotationId: number) => screen.getByRole("checkbox", { name: hereTitle(rotationId) });

    it("renders 'On <Card> now' ordered by artist, through base-sensitivity collation", async () => {
      fakeRotationAdminEndpoints(HERE_ROWS, [CARD, OTHER_CARD], { today: TODAY });
      renderWithProviders(<TestCardAssignmentPanel card={CARD} onClose={vi.fn()} />);
      await screen.findByText("On Heavy 3 now · 5");

      const order = [933, 934, 930, 931, 932].map((id) => hereBox(id));
      for (let i = 0; i + 1 < order.length; i += 1) {
        expect(order[i].compareDocumentPosition(order[i + 1])).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }
    });

    it("narrows 'On <Card> now' by search", async () => {
      fakeRotationAdminEndpoints(HERE_ROWS, [CARD, OTHER_CARD], { today: TODAY });
      const { user } = renderWithProviders(<TestCardAssignmentPanel card={CARD} onClose={vi.fn()} />);
      await screen.findByText("On Heavy 3 now · 5");

      await user.type(screen.getByRole("searchbox", { name: "Search Heavy" }), "nilufer");

      expect(screen.getByText("On Heavy 3 now · 1")).toBeInTheDocument();
      expect(hereBox(931)).toBeInTheDocument();
    });
  });

  describe("discard confirmation", () => {
    it("asks before closing via the Close button, and leaves the panel open when declined", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      const { user, onClose } = await renderPanel();
      await tick(user, [901]);

      await user.click(button("Close"));

      expect(confirmSpy).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("closes once the confirmation is accepted", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const { user, onClose } = await renderPanel();
      await tick(user, [901]);

      await user.click(button("Close"));

      expect(onClose).toHaveBeenCalledTimes(1);
      confirmSpy.mockRestore();
    });

    it("closes without asking when nothing is ticked", async () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      const { user, onClose } = await renderPanel();

      await user.click(button("Close"));

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
      confirmSpy.mockRestore();
    });

    it("asks alike on Escape and on a backdrop click", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const { user, onClose } = await renderPanel();
      await tick(user, [901]);

      await user.keyboard("{Escape}");
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      confirmSpy.mockReturnValue(false);
      await tick(user, [902]);
      await user.click(backdrop());
      expect(confirmSpy).toHaveBeenCalledTimes(2);
      // Declined, so the second close never went through.
      expect(onClose).toHaveBeenCalledTimes(1);
      confirmSpy.mockRestore();
    });

    it("does not ask to discard a tick on a record the next list read omits", async () => {
      const { store, onClose, user } = await renderPanel();
      await tick(user, [901]);

      // The record leaves the active read -- a kill made elsewhere, say --
      // so what Save could actually send is nothing, even though the tick
      // set still names it. The replacement answer is the same "active"
      // shape the fake would have served, minus that one row.
      const isActive = (row: RotationListRow) =>
        row.rotation_kill_date == null || row.rotation_kill_date > TODAY;
      const withoutRow = ROWS.filter((row) => row.rotation_id !== 901 && isActive(row));
      server.use(http.get(LIST_URL, () => HttpResponse.json(withoutRow), { once: true }));
      await act(async () => {
        await store.dispatch(
          rotationApi.endpoints.getRotationList.initiate("active", { forceRefetch: true }),
        );
      });
      await waitFor(() => expect(screen.queryByText(title(901))).not.toBeInTheDocument());

      const confirmSpy = vi.spyOn(window, "confirm");
      await user.click(button("Close"));

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
      confirmSpy.mockRestore();
    });
  });

  describe("Save & open the next card", () => {
    const NEXT_CARD = { id: 14, bin: "H", number: 4, name: null } as const;

    it("is absent when there is no next card", async () => {
      await renderPanel();
      expect(screen.queryByRole("button", { name: /Save & open/ })).not.toBeInTheDocument();
    });

    it("advances to the next card once every ticked move lands", async () => {
      const open = vi.fn();
      const { user } = await renderPanel({ next: { card: NEXT_CARD, open } });
      await tick(user, [901]);

      await user.click(button("Save & open Heavy 4"));

      await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    });

    it("stays on the current card and shows the failure when a move does not land", async () => {
      const open = vi.fn();
      const { fake, user } = await renderPanel({ next: { card: NEXT_CARD, open } });
      fake.failCardMove([901]);
      await tick(user, [901]);

      await user.click(button("Save & open Heavy 4"));

      await waitFor(() => expect(box(901)).toHaveAccessibleDescription("refused"));
      expect(open).not.toHaveBeenCalled();
    });

    it("offers Open instead of Save & open when nothing is ticked, and sends nothing", async () => {
      const open = vi.fn();
      const { fake, user } = await renderPanel({ next: { card: NEXT_CARD, open } });

      await user.click(button("Open Heavy 4"));

      expect(open).toHaveBeenCalledTimes(1);
      expect(fake.updateBodies()).toEqual([]);
    });

    it("offers Open, enabled, while the list read is still pending -- nothing is ticked either way", async () => {
      const open = vi.fn();
      const { fake, releaseList, user } = await renderPanel({
        next: { card: NEXT_CARD, open },
        firstRead: "held",
      });

      expect(button("Open Heavy 4")).toBeEnabled();

      await user.click(button("Open Heavy 4"));

      expect(open).toHaveBeenCalledTimes(1);
      expect(fake.updateBodies()).toEqual([]);
      await releaseList();
    });
  });

  describe("hidden pending moves", () => {
    it("counts ticked records the search has hidden from view", async () => {
      const { user } = await renderPanel();
      await tick(user, [901, 902]);

      await user.type(screen.getByRole("searchbox", { name: "Search Heavy" }), "molina");

      expect(button("Save 2 (1 hidden)")).toBeEnabled();

      await user.clear(screen.getByRole("searchbox", { name: "Search Heavy" }));

      expect(button("Save 2")).toBeEnabled();
    });

    it("carries the hidden count onto the Save & open label too, spaces intact across its line break", async () => {
      const NEXT_CARD = { id: 14, bin: "H", number: 4, name: null } as const;
      const { user } = await renderPanel({ next: { card: NEXT_CARD, open: vi.fn() } });
      await tick(user, [901, 902]);

      await user.type(screen.getByRole("searchbox", { name: "Search Heavy" }), "molina");

      expect(button("Save & open Heavy 4 (1 hidden)")).toBeEnabled();
    });
  });
});
