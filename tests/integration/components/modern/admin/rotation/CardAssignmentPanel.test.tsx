import { describe, it, expect, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeRotationAdminEndpoints, type FakeRotationAdminRow } from "@/tests/fakes/rotation";
import { server } from "@/tests/fakes/server";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

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
import CardAssignmentPanel from "@/src/components/experiences/modern/admin/rotation/CardAssignmentPanel";

const CARD = { id: 13, bin: "H", number: 3, name: "September" } as const;
const OTHER_CARD = { id: 11, bin: "H", number: 1, name: null } as const;
// The fake's "today". A kill dated after it is still active -- the panel's
// meaning of "active", wider than the Rotation list's -- and one dated on it
// is not.
const TODAY = "2026-09-20";
const KILLED_TODAY = 908;
const OTHER_BIN = 950;

const ROWS: FakeRotationAdminRow[] = (
  [
    [900, "Jessica Pratt", "On Your Own Love Again", CARD, null],
    [901, "Juana Molina", "DOGA", OTHER_CARD, null],
    [902, "Chuquimamani-Condori", "Edits", OTHER_CARD, null],
    [903, "Duke Ellington & John Coltrane", "Duke Ellington & John Coltrane", OTHER_CARD, null],
    [904, "Stereolab", "Dots and Loops", OTHER_CARD, null],
    [905, "Nilüfer Yanya", "PAINLESS", OTHER_CARD, null],
    [906, "Hermanos Gutiérrez", "El Bueno y el Malo", OTHER_CARD, null],
    [907, "Jessica Pratt", "Here in the Pitch", OTHER_CARD, "2026-09-25"],
    [KILLED_TODAY, "Stereolab", "Emperor Tomato Ketchup", OTHER_CARD, TODAY],
  ] as const
).map(([rotation_id, artist_name, album_title, card, rotation_kill_date]) => ({
  id: rotation_id,
  rotation_id,
  rotation_bin: "H",
  rotation_kill_date,
  card,
  artist_name,
  album_title,
}));
ROWS.push({
  id: OTHER_BIN,
  rotation_id: OTHER_BIN,
  rotation_bin: "M",
  rotation_kill_date: null,
  card: null,
  artist_name: "Cat Power",
  album_title: "Moon Pix",
});

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
}: { gateCardMoves?: boolean; firstRead?: "answered" | "held" | "failed" } = {}) {
  const fake = fakeRotationAdminEndpoints(ROWS, [CARD, OTHER_CARD], {
    today: TODAY,
    gateCardMoves,
  });
  if (firstRead === "held") fake.holdActiveListReads();
  // Registered after the fake, so it answers first, once; the fake's own
  // list arm answers every read after it.
  if (firstRead === "failed") server.use(http.get(LIST_URL, failedListRead, { once: true }));
  const onClose = vi.fn();
  const rendered = renderWithProviders(<CardAssignmentPanel card={CARD} onClose={onClose} />);
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
    expect(await screen.findByRole("status")).toHaveTextContent("Moving 1 of 2 to Heavy 3");
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

  it("keeps moved records locked and never resends them when the refetch after a save fails", async () => {
    const { fake, user } = await renderPanel();
    server.use(http.get(LIST_URL, failedListRead));

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
    const stale = ROWS.filter((row) => row.rotation_id !== KILLED_TODAY);
    server.use(http.get(LIST_URL, () => HttpResponse.json(stale), { once: true }));
    await user.click(button("Retry"));

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
});
