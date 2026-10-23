import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import EditShowDetailsDialog from "@/src/components/experiences/modern/EditShowDetailsDialog";
import {
  CLOSED_SHOW_SENTENCE,
  showPlaylistApi,
} from "@/lib/features/show-playlist/api";
import {
  REJECTED_PROGRAM_SENTENCE,
  SHOW_DETAILS_REFUSED_SENTENCE,
} from "@/lib/features/specialty/copy";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { error: toastError },
}));

const [ORANGE_COUNTY, HYPERLOCAL] = SEED_CATALOG;
const RETIRED = SEED_CATALOG.find((p) => !p.active)!;
const SHOW_ID = 77;

function serveCatalog() {
  server.use(http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(SEED_CATALOG)));
}

function serveSave(respond: () => Response = () => HttpResponse.json({})) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/${SHOW_ID}`, async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    })
  );
  return bodies;
}

function renderDialog(
  props: Partial<React.ComponentProps<typeof EditShowDetailsDialog>> = {}
) {
  serveCatalog();
  const onClose = vi.fn();
  const view = renderWithProviders(
    <EditShowDetailsDialog
      showId={SHOW_ID}
      specialty={null}
      showName={null}
      onClose={onClose}
      {...props}
    />
  );
  return { ...view, onClose };
}

const programSelect = () => screen.findByRole("combobox", { name: /program/i });
const titleInput = () => screen.getByRole("textbox", { name: /title/i });
const save = () => userEvent.click(screen.getByRole("button", { name: /^save$/i }));

async function choose(name: string) {
  await userEvent.click(await programSelect());
  await userEvent.click(await screen.findByRole("option", { name }));
}

describe("EditShowDetailsDialog", () => {
  it("lists the active programs plus None, and never a retired one", async () => {
    renderDialog();
    await userEvent.click(await programSelect());
    const names = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(names).toEqual([
      "None (freeform)",
      ...SEED_CATALOG.filter((p) => p.active).map((p) => p.name),
    ]);
  });

  it("preselects the current tag", async () => {
    renderDialog({ specialty: ORANGE_COUNTY });
    expect(await programSelect()).toHaveTextContent(ORANGE_COUNTY.name);
  });

  it("shows a retired current tag as the value, and lets it be cleared", async () => {
    const bodies = serveSave();
    renderDialog({ specialty: RETIRED });
    expect(await programSelect()).toHaveTextContent(RETIRED.name);
    await choose("None (freeform)");
    await save();
    await waitFor(() => expect(bodies).toEqual([{ specialty_id: null }]));
  });

  it("caps the title at 128 characters", () => {
    renderDialog();
    expect(titleInput()).toHaveAttribute("maxlength", "128");
  });

  it("sends the new program id and a trimmed title, then closes", async () => {
    const bodies = serveSave();
    const { onClose } = renderDialog({ specialty: ORANGE_COUNTY, showName: "Old" });
    await choose(HYPERLOCAL.name);
    await userEvent.clear(titleInput());
    await userEvent.type(titleInput(), "  Pumpkin Spice Special  ");
    await save();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ specialty_id: HYPERLOCAL.id, show_name: "Pumpkin Spice Special" }]);
  });

  it("sends only the title when only the title changed", async () => {
    const bodies = serveSave();
    renderDialog({ specialty: ORANGE_COUNTY, showName: "Old" });
    await userEvent.clear(titleInput());
    await userEvent.type(titleInput(), "New");
    await save();
    await waitFor(() => expect(bodies).toEqual([{ show_name: "New" }]));
  });

  it("clears the tag with null when None is chosen", async () => {
    const bodies = serveSave();
    renderDialog({ specialty: ORANGE_COUNTY });
    await choose("None (freeform)");
    await save();
    await waitFor(() => expect(bodies).toEqual([{ specialty_id: null }]));
  });

  it("sends nothing for a save with no change, and closes", async () => {
    const bodies = serveSave();
    const { onClose } = renderDialog({ specialty: ORANGE_COUNTY, showName: "Same" });
    await programSelect();
    await save();
    expect(onClose).toHaveBeenCalled();
    expect(bodies).toEqual([]);
  });

  it("refreshes the Previous Sets header for the show after a save", async () => {
    serveSave();
    const { onClose } = renderDialog({ specialty: ORANGE_COUNTY });
    const invalidate = vi.spyOn(showPlaylistApi.util, "invalidateTags");
    await choose(HYPERLOCAL.name);
    await save();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalledWith([{ type: "ShowPlaylist", id: SHOW_ID }]);
  });

  it.each([
    [
      "403 closed_show",
      () => HttpResponse.json({ code: "closed_show", message: "closed" }, { status: 403 }),
      { specialty_id: HYPERLOCAL.id },
      CLOSED_SHOW_SENTENCE,
    ],
    [
      "400 on a program change",
      () => HttpResponse.json({ message: "bad" }, { status: 400 }),
      { specialty_id: HYPERLOCAL.id },
      REJECTED_PROGRAM_SENTENCE,
    ],
    [
      "400 on a title-only change",
      () => HttpResponse.json({ message: "bad" }, { status: 400 }),
      { show_name: "New" },
      SHOW_DETAILS_REFUSED_SENTENCE,
    ],
  ])("words a %s as one sentence and leaves the form open", async (_n, respond, change, sentence) => {
    serveSave(respond);
    const { onClose } = renderDialog({ specialty: ORANGE_COUNTY });
    if ("specialty_id" in change) {
      await choose(HYPERLOCAL.name);
    } else {
      await userEvent.type(titleInput(), "New");
    }
    await save();
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("leaves a 403 without closed_show to the site's general handling", async () => {
    serveSave(() => HttpResponse.json({ message: "no" }, { status: 403 }));
    const { onClose } = renderDialog({ specialty: ORANGE_COUNTY });
    await choose(HYPERLOCAL.name);
    await save();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(CLOSED_SHOW_SENTENCE)).not.toBeInTheDocument();
  });
});
