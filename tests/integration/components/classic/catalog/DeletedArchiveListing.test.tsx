import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { DeletedArchiveBatch } from "@/lib/features/catalog/types";
import {
  createTestDeletedArchiveBatch,
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

// Mutable so one case can render mid-session: the query is skipped while the
// session resolves, and what a skipped query looks like is exactly what this
// screen used to mistake for a failed load.
const auth = vi.hoisted(() => ({
  state: { authenticating: false, authenticated: true },
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => auth.state,
}));

import DeletedArchiveListing from "@/src/components/experiences/classic/catalog/DeletedArchiveListing";

const DELETED_URL = `${TEST_BACKEND_URL}/library/deleted`;
const restoreUrl = (batchId: string) => `${TEST_BACKEND_URL}/library/deleted/${batchId}/restore`;

// The endpoint's own refusal bodies, verbatim. A body trimmed to the clause the
// assertion reads cannot tell the screen's wording apart from the server's, and
// the server's is where the API instructions and the raw row ids live.
const SERVER_UNRESTORABLE_KIND =
  "Cannot restore: this batch holds a 'artist' entity, which has no restore plan. This is permanent, not retryable.";
const SERVER_RESOLUTION_REQUIRED =
  "Cannot restore without a decision: the call code is held by another release. Re-send with resolution=next_free_code or resolution=decline.";
const SERVER_ALREADY_RESTORED =
  "Cannot restore: this batch is already back in the catalog (library ids: 53375)";

function mockListing(results: DeletedArchiveBatch[], overrides: Partial<{ total: number; page: number; totalPages: number }> = {}) {
  server.use(
    http.get(DELETED_URL, () =>
      HttpResponse.json({
        results,
        total: overrides.total ?? results.length,
        page: overrides.page ?? 0,
        totalPages: overrides.totalPages ?? 1,
      }),
    ),
  );
}

const restorableBatch = () =>
  createTestDeletedArchiveBatch({ batch_id: "batch-restorable", restorable: true });

async function clickRestore() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Restore" }));
}

beforeEach(() => {
  auth.state = { authenticating: false, authenticated: true };
});

describe("classic Recently Deleted listing — /dashboard/library/deleted", () => {
  it("renders a deleted card's date, call code, subject and deleter", async () => {
    mockListing([restorableBatch()]);

    renderWithProviders(<DeletedArchiveListing />);

    const row = await screen.findByTestId("deleted-archive-row");
    expect(within(row).getByText(/Jessica Pratt.*On Your Own Love Again/)).toBeInTheDocument();
    expect(within(row).getByText("5")).toBeInTheDocument();
    expect(within(row).getByText("musicDirector")).toBeInTheDocument();
  });

  it("waits for the session rather than claiming the archive could not be loaded", async () => {
    auth.state = { authenticating: true, authenticated: false };
    mockListing([restorableBatch()]);

    renderWithProviders(<DeletedArchiveListing />);

    // The query is skipped until the session resolves, and a skipped query is
    // uninitialized rather than loading or errored. Reporting a load failure
    // here would put a red alert on the screen before a request was attempted.
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says nothing has been deleted when the archive is empty", async () => {
    mockListing([]);

    renderWithProviders(<DeletedArchiveListing />);

    expect(await screen.findByText("Nothing has been deleted yet.")).toBeInTheDocument();
  });

  it("searches by re-querying with the typed term", async () => {
    mockListing([restorableBatch()]);
    renderWithProviders(<DeletedArchiveListing />);
    await screen.findByTestId("deleted-archive-row");

    let requestedSearch: string | null = null;
    server.use(
      http.get(DELETED_URL, ({ request }) => {
        requestedSearch = new URL(request.url).searchParams.get("search");
        return HttpResponse.json({ results: [], total: 0, page: 0, totalPages: 1 });
      }),
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search by artist or release title/i), "Pratt");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("No deleted cards match \"Pratt\".");
    expect(requestedSearch).toBe("Pratt");
  });

  it("pages through more than one page of results", async () => {
    mockListing([restorableBatch()], { total: 80, totalPages: 2 });
    renderWithProviders(<DeletedArchiveListing />);
    await screen.findByTestId("deleted-archive-row");

    let requestedPage: string | null = null;
    server.use(
      http.get(DELETED_URL, ({ request }) => {
        requestedPage = new URL(request.url).searchParams.get("page");
        return HttpResponse.json({
          results: [createTestDeletedArchiveBatch({ batch_id: "page-2-batch" })],
          total: 80,
          page: 1,
          totalPages: 2,
        });
      }),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next" }));

    await screen.findByText("Page 2 of 2 (80 total)");
    expect(requestedPage).toBe("1");
  });

  it("offers no Restore control for a batch the server marks unrestorable, and states why", async () => {
    mockListing([
      createTestDeletedArchiveBatch({
        batch_id: "batch-artist",
        restorable: false,
        entities: [{ entity_kind: "artist", table: "artists", row: { artist_name: "Stereolab" } }],
      }),
    ]);

    renderWithProviders(<DeletedArchiveListing />);

    const cell = await screen.findByTestId("deleted-archive-restore-cell");
    expect(within(cell).queryByRole("button", { name: "Restore" })).toBeNull();
    // Worded for a row that never offered the button — distinct from the
    // refusal a press can return, so one assertion cannot pass for both paths.
    expect(within(cell).getByRole("alert").textContent).toMatch(
      /cannot be brought back from this screen/i,
    );
  });

  it("restores a batch whose call-code slot is free, and the row reflects it", async () => {
    const batch = restorableBatch();
    mockListing([batch]);
    server.use(
      http.post(restoreUrl(batch.batch_id), () => HttpResponse.json({ batch_id: batch.batch_id })),
    );

    renderWithProviders(<DeletedArchiveListing />);
    await screen.findByTestId("deleted-archive-row");
    await clickRestore();

    expect(await screen.findByText("Restored")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });

  // A row can be LISTED as restorable and still be refused when the operator
  // presses Restore minutes later, because `restorable` is computed at read
  // time. The message must say permanent, not retryable, and the button must
  // not survive to invite a retry that can never succeed.
  it("handles a stale listing: 409 unrestorable_kind on press, permanent and not retryable", async () => {
    const batch = restorableBatch();
    mockListing([batch]);
    server.use(
      http.post(restoreUrl(batch.batch_id), () =>
        HttpResponse.json(
          {
            message: SERVER_UNRESTORABLE_KIND,
            reason: "unrestorable_kind",
            entity_kind: "artist",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<DeletedArchiveListing />);
    await screen.findByTestId("deleted-archive-row");
    await clickRestore();

    const cell = await screen.findByTestId("deleted-archive-restore-cell");
    const alert = await within(cell).findByRole("alert");
    // Permanence is the substance of this refusal: it is what tells the
    // operator that pressing again cannot work, and it is why the button goes.
    expect(alert.textContent).toMatch(/permanent, not retryable/i);
    expect(alert.textContent).not.toMatch(/brought back from this screen/i);
    expect(within(cell).queryByRole("button", { name: "Restore" })).toBeNull();
  });

  // Nothing on the listing changes when a restore succeeds, so the row keeps
  // its Restore button and a second press is the ordinary path — after a
  // reload, a double-click, or a second tab.
  it("tells the operator an already-restored batch is back, not that the restore failed", async () => {
    const batch = restorableBatch();
    mockListing([batch]);
    server.use(
      http.post(restoreUrl(batch.batch_id), () =>
        HttpResponse.json(
          { message: SERVER_ALREADY_RESTORED, reason: "already_restored", entity_ids: [53375] },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<DeletedArchiveListing />);
    await screen.findByTestId("deleted-archive-row");
    await clickRestore();

    const cell = await screen.findByTestId("deleted-archive-restore-cell");
    const alert = await within(cell).findByRole("alert");
    expect(alert.textContent).toMatch(/already back in the catalog/i);
    // "Nothing was changed" would send the operator looking for a card that is
    // already on the shelf.
    expect(alert.textContent).not.toMatch(/nothing was changed/i);
    expect(alert.textContent).not.toMatch(/53375/);
  });

  // This screen has no resolution UI, so the 400 must still surface as a
  // refusal the operator can read — not fail silently, and not look like a
  // success, and not instruct him to do something this screen cannot do.
  it("surfaces a 400 resolution_required as a readable refusal, without a resolution UI", async () => {
    const batch = restorableBatch();
    mockListing([batch]);
    server.use(
      http.post(restoreUrl(batch.batch_id), () =>
        HttpResponse.json(
          { message: SERVER_RESOLUTION_REQUIRED, reason: "resolution_required", conflicts: [] },
          { status: 400 },
        ),
      ),
    );

    renderWithProviders(<DeletedArchiveListing />);
    await screen.findByTestId("deleted-archive-row");
    await clickRestore();

    const cell = await screen.findByTestId("deleted-archive-restore-cell");
    const alert = await within(cell).findByRole("alert");
    expect(alert.textContent).toMatch(/held by another release/i);
    expect(alert.textContent).toMatch(/isn't available from this screen yet/i);
    // The server's sentence tells the caller to re-send with a `resolution`
    // parameter. There is nothing here to re-send it from.
    expect(alert.textContent).not.toMatch(/resolution=/);
    expect(screen.queryByText("Restored")).toBeNull();
  });
});
