import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

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
    serve({
      items: [filed({ id: 1 }), filed({ id: 2, album_id: 43, artist_name: "Cat Power", album_title: "Moon Pix" })],
      rotating: [{ ...ALBUM, id: 42, rotation_id: 9, rotation_bin: "H", rotation_add_date: "2026-08-01", rotation_kill_date: null }],
    });
    renderFacet({ canSeeFiled: true, canWrite: true });

    await screen.findByText("Moon Pix");
    expect(screen.queryByText("DOGA")).not.toBeInTheDocument();
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

  it("shows the server's message on a 409 in_rotation and refetches", async () => {
    const message = "This release is in rotation until 2026-12-01.";
    let reads = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        reads += 1;
        return HttpResponse.json([filed({})]);
      }),
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () =>
        HttpResponse.json({ message, reason: "in_rotation" }, { status: 409 }),
      ),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Confirm: DOGA" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    await waitFor(() => expect(reads).toBeGreaterThan(1));
  });

  it("shows the screen's own failure line, not the server's text, on any other refusal", async () => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/1/finalize`, () =>
        HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
      ),
    );
    const { user } = renderFacet({ canSeeFiled: true, canWrite: true });

    await user.click(await screen.findByRole("button", { name: "Confirm: DOGA" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't do that. Please try again.");
    expect(screen.queryByText(/server words/)).not.toBeInTheDocument();
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
