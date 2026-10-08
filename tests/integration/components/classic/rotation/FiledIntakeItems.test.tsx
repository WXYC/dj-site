import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { rotationApi } from "@/lib/features/rotation/api";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import RotationReleaseList from "@/src/components/experiences/classic/rotation/RotationReleaseList";

const filed = (overrides: Partial<IntakeItem>): IntakeItem =>
  ({
    id: 1,
    artist_name: "Juana Molina",
    album_title: "DOGA",
    record_label: "Sonamos",
    format_id: 1,
    state: "filed",
    effective_state: "filed",
    album_id: 42,
    rotation_id: null,
    ...overrides,
  }) as IntakeItem;

const ALBUM = {
  id: 42,
  code_letters: "MOL",
  code_artist_number: 1,
  code_number: 3,
  artist_name: "Juana Molina",
  alphabetical_name: "Molina, Juana",
  album_title: "DOGA",
  record_label: "Sonamos",
  genre_name: "Rock",
  format_name: "CD",
  legacy_release_id: 7001,
};

function serve({ items, rotating = [] }: { items: IntakeItem[]; rotating?: unknown[] }) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) =>
      HttpResponse.json(new URL(request.url).searchParams.get("state") === "filed" ? items : []),
    ),
    http.get(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json(rotating)),
    http.get(`${TEST_BACKEND_URL}/library/rotation/uncatalogued`, () => HttpResponse.json([])),
    http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
    http.get(`${TEST_BACKEND_URL}/library/info`, () => HttpResponse.json(ALBUM)),
  );
}

const ROTATING_DOGA = { ...ALBUM, id: 42, rotation_id: 9, rotation_bin: "H", rotation_add_date: "2026-08-01", rotation_kill_date: null };
const MOON_PIX = filed({ id: 2, album_id: 43, artist_name: "Cat Power", album_title: "Moon Pix" });
const OUTAGE = "Rotation releases are unavailable right now.";

const renderFacet = (props: { canSeeFiled: boolean; canWrite: boolean }) =>
  renderWithProviders(<RotationReleaseList statusFilter="uncataloged" {...props} />);

describe("classic Awaiting Cataloging — filed intake items", () => {
  beforeEach(() => serve({ items: [filed({})] }));
  afterEach(() => vi.restoreAllMocks());

  it("lists a filed item with the call number the music director chose", async () => {
    renderFacet({ canSeeFiled: true, canWrite: true });

    const row = (await screen.findByText("DOGA")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Juana Molina")).toBeInTheDocument();
    await waitFor(() => expect(within(row).getByText(/MOL/)).toBeInTheDocument());
  });

  it("hides an item whose release is in active rotation, and shows one that is not", async () => {
    serve({ items: [filed({ id: 1 }), MOON_PIX], rotating: [ROTATING_DOGA] });
    renderFacet({ canSeeFiled: true, canWrite: true });

    await screen.findByText("Moon Pix");
    expect(screen.queryByText("DOGA")).not.toBeInTheDocument();
  });

  it("shows a hidden item once a later read of active rotation no longer lists its release", async () => {
    let rotating: unknown[] = [ROTATING_DOGA];
    serve({ items: [filed({ id: 1 }), MOON_PIX] });
    server.use(http.get(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json(rotating)));
    const { store } = renderFacet({ canSeeFiled: true, canWrite: true });

    await screen.findByText("Moon Pix");
    expect(screen.queryByText("DOGA")).not.toBeInTheDocument();

    rotating = [];
    store.dispatch(rotationApi.util.invalidateTags(["Rotation"]));

    expect(await screen.findByText("DOGA")).toBeInTheDocument();
  });

  it.each([
    ["a 503 from the filed intake read", "/intake", () => HttpResponse.json({ message: "down" }, { status: 503 })],
    [
      "a non-JSON body from the filed intake read",
      "/intake",
      () => new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    ],
    ["a 503 from the active rotation read", "/library/rotation", () => HttpResponse.json({ message: "down" }, { status: 503 })],
  ])("shows the outage panel, not an empty section, on %s, and recovers on Try again", async (_case, path, fail) => {
    let failing = true;
    server.use(
      http.get(`${TEST_BACKEND_URL}${path}`, ({ request }) => {
        if (failing) return fail();
        const filedRead = new URL(request.url).searchParams.get("state") === "filed";
        return HttpResponse.json(path === "/intake" && filedRead ? [filed({})] : []);
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    expect(await screen.findByText(OUTAGE)).toBeInTheDocument();
    expect(screen.queryByText("DOGA")).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("DOGA")).toBeInTheDocument();
    expect(screen.queryByText(OUTAGE)).not.toBeInTheDocument();
  });

  it("confirms with a POST to finalize", async () => {
    let posted: string | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/finalize`, ({ request }) => {
        posted = new URL(request.url).pathname;
        return HttpResponse.json(filed({ state: "finalized" }));
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Confirm: DOGA" }));

    await waitFor(() => expect(posted).toBe("/intake/1/finalize"));
  });

  it("keeps the row locked until the refetched lists land, so a second click sends no second POST", async () => {
    let posts = 0;
    let finalized = false;
    let releaseRead!: () => void;
    const readHeld = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, async () => {
        if (!finalized) return HttpResponse.json([filed({})]);
        await readHeld;
        return HttpResponse.json([]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () => {
        posts += 1;
        finalized = true;
        return HttpResponse.json(filed({ state: "finalized" }));
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    const confirm = await screen.findByRole("button", { name: "Confirm: DOGA" });
    await user.click(confirm);
    await waitFor(() => expect(posts).toBe(1));
    // The POST has resolved; the refetch is still held.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(posts).toBe(1);

    releaseRead();
    await waitFor(() => expect(screen.queryByText("DOGA")).not.toBeInTheDocument());
    expect(posts).toBe(1);
  });

  it("changes the code with a PATCH, then finalizes", async () => {
    const calls: string[] = [];
    let patched: unknown;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/42`, async ({ request }) => {
        calls.push("patch");
        patched = await request.json();
        return HttpResponse.json(ALBUM);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () => {
        calls.push("finalize");
        return HttpResponse.json(filed({ state: "finalized" }));
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Change the code: DOGA" }));
    const number = screen.getByLabelText("Call number");
    await user.clear(number);
    await user.type(number, "7");
    await user.click(screen.getByRole("button", { name: "Save and confirm" }));

    await waitFor(() => expect(calls).toEqual(["patch", "finalize"]));
    expect(patched).toEqual({ code_number: 7 });
  });

  it("shows the row's failure line, and finalizes nothing, when the call-number PATCH fails", async () => {
    let finalizes = 0;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/42`, () => HttpResponse.json({ message: "server words" }, { status: 500 })),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () => {
        finalizes += 1;
        return HttpResponse.json(filed({ state: "finalized" }));
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Change the code: DOGA" }));
    const number = screen.getByLabelText("Call number");
    await user.clear(number);
    await user.type(number, "7");
    await user.click(screen.getByRole("button", { name: "Save and confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't do that. Please try again.");
    expect(screen.queryByText(/server words/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save and confirm" })).toBeEnabled());
    expect(finalizes).toBe(0);
  });

  it("shows the server's message on a 409 in_rotation and re-reads active rotation, which hides the row", async () => {
    const message = "This release is in rotation until 2026-12-01.";
    let rotationReads = 0;
    serve({ items: [filed({}), MOON_PIX] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () => {
        rotationReads += 1;
        return HttpResponse.json(rotationReads === 1 ? [] : [ROTATING_DOGA]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () =>
        HttpResponse.json({ message, reason: "in_rotation" }, { status: 409 }),
      ),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Confirm: DOGA" }));

    await waitFor(() => expect(screen.queryByText("DOGA")).not.toBeInTheDocument());
    expect(screen.getByText("Moon Pix")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("treats a 409 state_changed as a lost race: no failure line, and the refetched list drops the row", async () => {
    let finalizedElsewhere = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(finalizedElsewhere ? [MOON_PIX] : [filed({}), MOON_PIX])),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () => {
        finalizedElsewhere = true;
        return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Confirm: DOGA" }));

    await waitFor(() => expect(screen.queryByText("DOGA")).not.toBeInTheDocument());
    expect(screen.getByText("Moon Pix")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/server words/)).not.toBeInTheDocument();
  });

  it("shows no failure line on a 409 state_changed while the row is still listed", async () => {
    let finalizedElsewhere = false;
    let releaseRead!: () => void;
    const readHeld = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, async () => {
        if (!finalizedElsewhere) return HttpResponse.json([filed({}), MOON_PIX]);
        await readHeld;
        return HttpResponse.json([MOON_PIX]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () => {
        finalizedElsewhere = true;
        return HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 });
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    const confirm = await screen.findByRole("button", { name: "Confirm: DOGA" });
    await user.click(confirm);
    // The POST has been refused; the intake reload is still held, so the row is still listed.
    await waitFor(() => expect(finalizedElsewhere).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("DOGA")).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    releaseRead();
    await waitFor(() => expect(screen.queryByText("DOGA")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the screen's own failure line, not the server's text, on any other refusal", async () => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () =>
        HttpResponse.json({ message: "server words", reason: "something_else" }, { status: 409 }),
      ),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Confirm: DOGA" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't do that. Please try again.");
    expect(screen.queryByText(/server words/)).not.toBeInTheDocument();
  });

  it("drops the failure line once the refetched list no longer has the row", async () => {
    let finalized = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(finalized ? [] : [filed({})])),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () => {
        finalized = true;
        return HttpResponse.json({ message: "server words" }, { status: 500 });
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Confirm: DOGA" }));

    await waitFor(() => expect(screen.queryByText("DOGA")).not.toBeInTheDocument());
    expect(screen.queryByText("Couldn't do that. Please try again.")).not.toBeInTheDocument();
    expect(screen.queryByText("Filed, awaiting your confirmation")).not.toBeInTheDocument();
  });

  it("leaves Change the code without saving on Cancel", async () => {
    const writes: string[] = [];
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/42`, () => {
        writes.push("patch");
        return HttpResponse.json(ALBUM);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () => {
        writes.push("finalize");
        return HttpResponse.json(filed({ state: "finalized" }));
      }),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Change the code: DOGA" }));
    await user.type(screen.getByLabelText("Call number"), "7");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Call number")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save and confirm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm: DOGA" })).toBeEnabled();
    expect(writes).toEqual([]);
  });

  it("shows no filed items when the viewer is not shown the reviews screens", async () => {
    renderFacet({ canSeeFiled: false, canWrite: true });

    await screen.findByText(/Show killed releases too/);
    expect(screen.queryByText("DOGA")).not.toBeInTheDocument();
  });

  it("lists the items without Confirm or Change the code when the viewer cannot write", async () => {
    renderFacet({ canSeeFiled: true, canWrite: false });

    await screen.findByText("DOGA");
    expect(screen.queryByRole("button", { name: /^Confirm: / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Change the code: / })).not.toBeInTheDocument();
  });
});
