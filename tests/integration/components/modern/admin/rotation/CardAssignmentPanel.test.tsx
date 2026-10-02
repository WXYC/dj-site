import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { fakeRotationAdminEndpoints, type FakeRotationAdminRow } from "@/tests/fakes/rotation";

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
// A kill scheduled for a later day than this is still active -- the panel's
// own meaning of "active", wider than the Rotation list's.
const TODAY = "2026-09-20";

const ROWS: FakeRotationAdminRow[] = [
  {
    id: 1,
    rotation_id: 900,
    rotation_bin: "H",
    rotation_kill_date: null,
    card: CARD,
    artist_name: "Jessica Pratt",
    album_title: "Here in the Pitch",
  },
  {
    id: 2,
    rotation_id: 901,
    rotation_bin: "H",
    rotation_kill_date: null,
    card: OTHER_CARD,
    artist_name: "Juana Molina",
    album_title: "DOGA",
  },
  {
    id: 3,
    rotation_id: 902,
    rotation_bin: "H",
    rotation_kill_date: null,
    card: OTHER_CARD,
    artist_name: "Chuquimamani-Condori",
    album_title: "Edits",
  },
  {
    id: 4,
    rotation_id: 903,
    rotation_bin: "H",
    rotation_kill_date: "2026-09-25",
    card: OTHER_CARD,
    artist_name: "Duke Ellington & John Coltrane",
    album_title: "Duke Ellington & John Coltrane",
  },
  // A different bin's active row never appears on this card's panel.
  {
    id: 5,
    rotation_id: 950,
    rotation_bin: "M",
    rotation_kill_date: null,
    card: null,
    artist_name: "Stereolab",
    album_title: "Dots and Loops",
  },
];

function renderPanel({ gateCardMoves = false } = {}) {
  const fake = fakeRotationAdminEndpoints(ROWS, [CARD, OTHER_CARD], {
    today: TODAY,
    gateCardMoves,
  });
  const onClose = vi.fn();
  const rendered = renderWithProviders(<CardAssignmentPanel card={CARD} onClose={onClose} />);
  return { fake, onClose, ...rendered };
}

describe("CardAssignmentPanel", () => {
  it("shows the bin's active records, members checked and locked, others showing their card", async () => {
    renderPanel();

    expect(await screen.findByText("On Heavy 3 now · 1")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Jessica Pratt — Here in the Pitch" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Jessica Pratt — Here in the Pitch" }),
    ).toBeDisabled();

    // Heavy 950's bin (M) never appears; a future-dated kill (903) still does.
    expect(screen.getByText("Elsewhere in Heavy · 3")).toBeInTheDocument();
    expect(screen.queryByText(/Stereolab/)).not.toBeInTheDocument();
    const juana = screen.getByRole("checkbox", { name: "Juana Molina — DOGA" });
    expect(juana).not.toBeChecked();
    expect(juana).toBeEnabled();
    // 901, 902 and 903 are all still on Heavy 1.
    expect(screen.getAllByText("Heavy 1")).toHaveLength(3);
  });

  it("saves exactly the newly ticked records onto the card, never reading the unbounded history", async () => {
    const { fake, user } = renderPanel();
    await screen.findByText("On Heavy 3 now · 1");

    await user.click(screen.getByRole("checkbox", { name: "Juana Molina — DOGA" }));
    await user.click(screen.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" }));
    await user.click(screen.getByRole("button", { name: "Save 2" }));

    await waitFor(() =>
      expect(fake.updateBodies()).toEqual([
        { id: 901, body: { card_id: CARD.id } },
        { id: 902, body: { card_id: CARD.id } },
      ]),
    );
    // Never the unbounded history read.
    expect(fake.listStatuses()).not.toContain("all");
  });

  it("shows live progress while a save runs and refuses to close", async () => {
    const { fake, onClose, user } = renderPanel({ gateCardMoves: true });
    await screen.findByText("On Heavy 3 now · 1");

    await user.click(screen.getByRole("checkbox", { name: "Juana Molina — DOGA" }));
    await user.click(screen.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" }));
    await user.click(screen.getByRole("button", { name: "Save 2" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Moving 0 of 2 to Heavy 3");
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    await fake.releaseCardMoveOnceRequested(901);
    expect(await screen.findByRole("status")).toHaveTextContent("Moving 1 of 2 to Heavy 3");
    await fake.releaseCardMoveOnceRequested(902);

    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toBeEnabled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a partial failure distinctly, and Retry resends only the failed record", async () => {
    const { fake, user } = renderPanel();
    await screen.findByText("On Heavy 3 now · 1");
    fake.failCardMove([902]);

    await user.click(screen.getByRole("checkbox", { name: "Juana Molina — DOGA" }));
    await user.click(screen.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" }));
    await user.click(screen.getByRole("button", { name: "Save 2" }));

    expect(await screen.findByText("refused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry 1" })).toBeInTheDocument();

    fake.failCardMove([]);
    await user.click(screen.getByRole("button", { name: "Retry 1" }));

    // The retried record joins the locked membership list once the refetch
    // lands -- it never vanishes, since the panel always renders every
    // active row somewhere.
    await waitFor(() => expect(screen.getByText("On Heavy 3 now · 3")).toBeInTheDocument());
    expect(screen.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" })).toBeDisabled();
  });

  // The hook's own `retry()` has no way to narrow its resend, so unticking a
  // failed record must fall through to a fresh `save` rather than calling
  // it -- otherwise a record a librarian just decided does not belong here
  // would still get sent.
  it("sends a fresh save, not a blanket retry, once a failed record is unticked", async () => {
    const { fake, user } = renderPanel();
    await screen.findByText("On Heavy 3 now · 1");
    fake.failCardMove([901, 902]);

    await user.click(screen.getByRole("checkbox", { name: "Juana Molina — DOGA" }));
    await user.click(screen.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" }));
    await user.click(screen.getByRole("button", { name: "Save 2" }));
    await waitFor(() => expect(screen.getAllByText("refused")).toHaveLength(2));

    fake.failCardMove([]);
    await user.click(screen.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" }));
    await user.click(screen.getByRole("button", { name: "Save 1" }));

    await waitFor(() => expect(screen.getByText("On Heavy 3 now · 2")).toBeInTheDocument());
    expect(fake.updateBodies().map((update) => update.id)).toEqual([901, 902, 901]);
    expect(screen.getByRole("checkbox", { name: "Chuquimamani-Condori — Edits" })).not.toBeChecked();
  });

  it("shows moved, failed and not-attempted records distinctly after a stopped batch, with one Retry covering both", async () => {
    const stopRows: FakeRotationAdminRow[] = [
      { id: 1, rotation_id: 900, rotation_bin: "H", rotation_kill_date: null, card: CARD },
      ...[901, 902, 903, 904, 905].map((rotationId) => ({
        id: rotationId,
        rotation_id: rotationId,
        rotation_bin: "H",
        rotation_kill_date: null,
        card: OTHER_CARD,
        artist_name: `Artist ${rotationId}`,
        album_title: `Album ${rotationId}`,
      })),
    ];
    const fake = fakeRotationAdminEndpoints(stopRows, [CARD, OTHER_CARD], { today: TODAY });
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <CardAssignmentPanel card={CARD} onClose={onClose} />,
    );
    await screen.findByText("On Heavy 3 now · 1");
    fake.failCardMove([901, 902, 903]);

    for (const rotationId of [901, 902, 903, 904, 905]) {
      await user.click(screen.getByRole("checkbox", { name: `Artist ${rotationId} — Album ${rotationId}` }));
    }
    await user.click(screen.getByRole("button", { name: "Save 5" }));

    await waitFor(() => expect(screen.getAllByText("refused")).toHaveLength(3));
    expect(screen.getAllByText(/Not attempted/)).toHaveLength(2);
    const retry = screen.getByRole("button", { name: "Retry 5" });

    fake.failCardMove([]);
    await user.click(retry);

    await waitFor(() => expect(screen.getByText("On Heavy 3 now · 6")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
