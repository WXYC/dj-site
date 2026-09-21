import { describe, it, expect, vi } from "vitest";
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

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import DeletedArchiveListing from "@/src/components/experiences/classic/catalog/DeletedArchiveListing";

const DELETED_URL = `${TEST_BACKEND_URL}/library/deleted`;
const restoreUrl = (batchId: string) => `${TEST_BACKEND_URL}/library/deleted/${batchId}/restore`;

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

describe("classic Recently Deleted listing — /dashboard/library/deleted", () => {
  it("renders a deleted card's date, call code, subject and deleter", async () => {
    mockListing([restorableBatch()]);

    renderWithProviders(<DeletedArchiveListing />);

    const row = await screen.findByTestId("deleted-archive-row");
    expect(within(row).getByText(/Jessica Pratt.*On Your Own Love Again/)).toBeInTheDocument();
    expect(within(row).getByText("5")).toBeInTheDocument();
    expect(within(row).getByText("musicDirector")).toBeInTheDocument();
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
    expect(cell.textContent).toMatch(/no restore plan/i);
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
            message: "Cannot restore: this batch holds a 'artist' entity, which has no restore plan.",
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
    expect(cell.textContent).toMatch(/no restore plan/i);
    expect(within(cell).queryByRole("button", { name: "Restore" })).toBeNull();
  });

  // This screen has no resolution UI, so the 400 must still surface as a
  // refusal the operator can read — not fail silently, and not look like a
  // success.
  it("surfaces a 400 resolution_required as a readable refusal, without a resolution UI", async () => {
    const batch = restorableBatch();
    mockListing([batch]);
    server.use(
      http.post(restoreUrl(batch.batch_id), () =>
        HttpResponse.json(
          {
            message: "Cannot restore without a decision: the call code is held by another release.",
            reason: "resolution_required",
            conflicts: [],
          },
          { status: 400 },
        ),
      ),
    );

    renderWithProviders(<DeletedArchiveListing />);
    await screen.findByTestId("deleted-archive-row");
    await clickRestore();

    const cell = await screen.findByTestId("deleted-archive-restore-cell");
    expect(cell.textContent).toMatch(/held by another release/i);
    expect(screen.queryByText("Restored")).toBeNull();
  });
});
