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

const [ORANGE_COUNTY, HYPERLOCAL, BACKYARD_BBQ] = SEED_CATALOG;
const RETIRED = SEED_CATALOG.find((p) => !p.active)!;
const SHOW_ID = 77;
// Station (Eastern) wall clock; late October 2026 is still EDT (UTC-4).
const MONDAY_MORNING = "2026-10-26T15:00:00Z";
const SUNDAY_NOON = "2026-10-25T16:00:00Z";
const SUNDAY_ELEVEN_FIFTY_FIVE = "2026-10-25T15:55:00Z";
const SUNDAY_FOUR = "2026-10-25T20:00:00Z";

function serveCatalog(catalog = SEED_CATALOG) {
  server.use(http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(catalog)));
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
  props: Partial<React.ComponentProps<typeof EditShowDetailsDialog>> = {},
  catalog = SEED_CATALOG
) {
  serveCatalog(catalog);
  const onClose = vi.fn();
  const view = renderWithProviders(
    <EditShowDetailsDialog
      showId={SHOW_ID}
      specialty={null}
      showName={null}
      startTime={MONDAY_MORNING}
      onClose={onClose}
      {...props}
    />
  );
  return { ...view, onClose };
}

const programSelect = () => screen.findByRole("combobox", { name: /program/i });

/**
 * Opens the program select and waits for a named program to be listed. The
 * select renders before the catalog request resolves, so an assertion that
 * the hint is absent only means something once the catalog has loaded.
 */
async function catalogLoaded(name: string) {
  await userEvent.click(await programSelect());
  await screen.findByRole("option", { name });
}
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

  it("opens on None, without crashing, when the server sent no specialty", async () => {
    renderDialog({ specialty: undefined });
    expect(await programSelect()).toHaveTextContent("None (freeform)");
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

  describe("time-slot hint", () => {
    const hint = (name: string) => `This time slot usually airs ${name}.`;

    it.each([
      ["inside a slot", SUNDAY_NOON, ORANGE_COUNTY.name],
      ["inside the ten-minute lead before a slot", SUNDAY_ELEVEN_FIFTY_FIVE, ORANGE_COUNTY.name],
      ["a slot two programs share names the first in catalog order", SUNDAY_FOUR, HYPERLOCAL.name],
    ])("names the program when the show started %s", async (_case, startTime, name) => {
      renderDialog({ startTime });
      expect(await screen.findByText(hint(name))).toBeInTheDocument();
    });

    it("shows nothing when the show started outside every slot", async () => {
      renderDialog({ startTime: MONDAY_MORNING });
      await catalogLoaded(ORANGE_COUNTY.name);
      expect(screen.queryByText(/usually airs/)).not.toBeInTheDocument();
    });

    it.each([
      ["the first of two programs sharing the slot", HYPERLOCAL],
      ["the second of two programs sharing the slot", BACKYARD_BBQ],
    ])("shows nothing when the show is tagged with %s", async (_case, specialty) => {
      renderDialog({ startTime: SUNDAY_FOUR, specialty });
      await catalogLoaded(ORANGE_COUNTY.name);
      expect(screen.queryByText(/usually airs/)).not.toBeInTheDocument();
    });

    it("names the first program a shared slot lists for a show tagged with a program outside the slot", async () => {
      renderDialog({ startTime: SUNDAY_FOUR, specialty: ORANGE_COUNTY });
      expect(await screen.findByText(hint(HYPERLOCAL.name))).toBeInTheDocument();
    });

    it("shows nothing when the show is already tagged with the matching program", async () => {
      renderDialog({ startTime: SUNDAY_NOON, specialty: ORANGE_COUNTY });
      await catalogLoaded(HYPERLOCAL.name);
      expect(screen.queryByText(/usually airs/)).not.toBeInTheDocument();
    });

    it("names the matching program for a show tagged with a different one", async () => {
      renderDialog({ startTime: SUNDAY_NOON, specialty: HYPERLOCAL });
      expect(await screen.findByText(hint(ORANGE_COUNTY.name))).toBeInTheDocument();
    });

    it("never names a retired program", async () => {
      // HyperLocal is active and outside Sunday noon, so listing it proves the
      // catalog loaded while the retired program is the only slot match.
      renderDialog({ startTime: SUNDAY_NOON }, [RETIRED, HYPERLOCAL]);
      await catalogLoaded(HYPERLOCAL.name);
      expect(screen.queryByText(/usually airs/)).not.toBeInTheDocument();
    });

    it("leaves the selection and the PATCH body alone", async () => {
      const bodies = serveSave();
      renderDialog({ startTime: SUNDAY_NOON, showName: "Old" });
      await screen.findByText(hint(ORANGE_COUNTY.name));
      expect(await programSelect()).toHaveTextContent("None (freeform)");
      await userEvent.clear(titleInput());
      await userEvent.type(titleInput(), "New");
      await save();
      await waitFor(() => expect(bodies).toEqual([{ show_name: "New" }]));
    });
  });
});
