import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

import RotationImportScreen from "@/src/components/experiences/classic/rotation/RotationImportScreen";

const LIBRARY = `${TEST_BACKEND_URL}/library`;

const ROTATION_ROW = {
  id: 6002,
  album_id: null,
  rotation_bin: "L",
  add_date: "2026-01-10",
  kill_date: "2026-02-01",
  artist_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  format_id: 3,
  label_id: null,
};

function mockRotationRow(row: Record<string, unknown> = ROTATION_ROW) {
  server.use(http.get(`${LIBRARY}/rotation/:id`, () => HttpResponse.json(row)));
}

function mockFormats(rows: Record<string, unknown>[] = [{ id: 3, format_name: "CD" }, { id: 4, format_name: "LP" }]) {
  server.use(http.get(`${LIBRARY}/formats`, () => HttpResponse.json(rows)));
}

describe("classic RotationImportScreen — rotationReleaseImport.jsp", () => {
  beforeEach(() => {
    mockRotationRow();
    mockFormats();
  });

  // Xerox assertion against `rotationReleaseImport.jsp`: the two header
  // links, the heading, and the Rotation Release summary table's seven rows
  // in the JSP's order.
  it("renders the JSP's header links, heading, and summary rows in order", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByText("Chuquimamani-Condori")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Back to Import Queue" })).toHaveAttribute(
      "href",
      "/dashboard/rotation?status=uncataloged",
    );
    expect(screen.getByRole("link", { name: "All Rotation Releases" })).toHaveAttribute(
      "href",
      "/dashboard/rotation",
    );
    expect(
      screen.getByRole("heading", { name: "Import Rotation Release to Library" }),
    ).toBeInTheDocument();

    const summary = screen.getByRole("table", { name: "Rotation Release" });
    const labels = within(summary)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent);
    expect(labels).toEqual(["Artist:", "Title:", "Label:", "Format:", "Rotation:", "Added:", "Killed:"]);
  });

  it("shows the rotation row's own snapshot, with its format resolved to a name", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    const summary = await screen.findByRole("table", { name: "Rotation Release" });
    expect(within(summary).getByText("Chuquimamani-Condori")).toBeInTheDocument();
    expect(within(summary).getByText("Edits")).toBeInTheDocument();
    expect(within(summary).getByText("self-released")).toBeInTheDocument();
    expect(within(summary).getByText("CD")).toBeInTheDocument();
    expect(within(summary).getByText("Light")).toBeInTheDocument();
    expect(within(summary).getByText("01/10/26")).toBeInTheDocument();
    expect(within(summary).getByText("02/01/26")).toBeInTheDocument();
  });

  // The projection is join-free by design, so a format the formats list has
  // not answered for yet has no name to show. An id is not a name, and
  // printing one would read as a format called "3".
  it("leaves the Format row blank rather than printing the raw id", async () => {
    mockFormats([]);
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    const summary = await screen.findByRole("table", { name: "Rotation Release" });
    expect(within(summary).queryByText("3")).not.toBeInTheDocument();
  });

  // A screen that exists to catalog one release must never render an
  // unreadable backend as a blank release to catalog.
  it("reports an outage instead of an empty summary", async () => {
    server.use(
      http.get(
        `${LIBRARY}/rotation/:id`,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(screen.queryByRole("table", { name: "Rotation Release" })).not.toBeInTheDocument();
  });

  it("says so when the rotation release is not in the queue", async () => {
    server.use(
      http.get(`${LIBRARY}/rotation/:id`, () =>
        HttpResponse.json({ message: "Rotation entry not found" }, { status: 404 }),
      ),
    );
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer in the queue/i);
  });

  // A row that is already linked has nothing to import, and offering the
  // form anyway is how a second library release gets minted for a release
  // someone already catalogued.
  it("refuses a row that has already been catalogued", async () => {
    mockRotationRow({ ...ROTATION_ROW, album_id: 42 });
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/already been catalogued/i);
    expect(screen.queryByRole("table", { name: "Rotation Release" })).not.toBeInTheDocument();
  });
});
