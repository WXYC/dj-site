import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import OpenShowsTable from "@/src/components/experiences/modern/admin/shows/OpenShowsTable";
import type { OpenShow } from "@/lib/features/flowsheet/types";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// The base query's prepareHeaders would otherwise fetch a JWT from an auth
// server these tests don't run.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

const show = (overrides: Partial<OpenShow> = {}): OpenShow => ({
  id: 1951200,
  primary_dj_id: null,
  dj_name: "dj sue",
  show_name: null,
  start_time: "2026-09-01T23:00:00.000Z",
  legacy_show_id: null,
  entry_count: 12,
  is_current: false,
  likely_abandoned: true,
  ...overrides,
});

const listHandler = (
  body: {
    shows: OpenShow[];
    total_in_window: number;
    older_open_show_count: number;
  },
  onRequest?: (url: URL) => void
) =>
  http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(body);
  });

describe("OpenShowsTable", () => {
  it("renders the rows in the order the server sends, with status badges", async () => {
    server.use(
      listHandler({
        shows: [
          show({ id: 1951100, dj_name: "dj sue", is_current: false }),
          show({
            id: 1951317,
            dj_name: "eureka!",
            is_current: true,
            likely_abandoned: false,
            entry_count: 206,
          }),
        ],
        total_in_window: 2,
        older_open_show_count: 0,
      })
    );

    renderWithProviders(<OpenShowsTable />);

    await waitFor(() => {
      expect(screen.getByTestId("open-show-row-1951100")).toBeInTheDocument();
    });
    const rows = screen.getAllByTestId(/open-show-row-/);
    expect(rows[0]).toHaveAttribute("data-testid", "open-show-row-1951100");
    expect(rows[1]).toHaveAttribute("data-testid", "open-show-row-1951317");
    expect(rows[0]).toHaveTextContent("likely abandoned");
    expect(rows[1]).toHaveTextContent("ON AIR");
  });

  it("shows the truncation notice only when the window holds more than the page", async () => {
    server.use(
      listHandler({
        shows: [show()],
        total_in_window: 7,
        older_open_show_count: 0,
      })
    );

    renderWithProviders(<OpenShowsTable />);

    await waitFor(() => {
      expect(
        screen.getByText(/Showing 1 of 7 open shows/)
      ).toBeInTheDocument();
    });
  });

  it("re-queries with the widened window when the operator asks for the backlog", async () => {
    const requested: URL[] = [];
    server.use(
      listHandler(
        { shows: [show()], total_in_window: 1, older_open_show_count: 2812 },
        (url) => requested.push(url)
      )
    );

    renderWithProviders(<OpenShowsTable />);
    await waitFor(() => {
      expect(screen.getByText(/2812 older open shows/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("open-shows-show-all"));

    await waitFor(() => {
      const widened = requested.find(
        (url) => url.searchParams.get("window_hours") === "262800"
      );
      expect(widened).toBeDefined();
      expect(widened?.searchParams.get("limit")).toBe("500");
    });
  });

  it("keeps the empty state and the failed read distinct", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, () =>
        HttpResponse.html("<!DOCTYPE html><html><body>404</body></html>", {
          status: 404,
        })
      )
    );

    renderWithProviders(<OpenShowsTable />);

    await waitFor(() => {
      expect(
        screen.getByText(/Could not load the open shows list/)
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/No open shows/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders the empty state on a genuinely empty answer", async () => {
    server.use(
      listHandler({ shows: [], total_in_window: 0, older_open_show_count: 0 })
    );

    renderWithProviders(<OpenShowsTable />);

    await waitFor(() => {
      expect(screen.getByText(/No open shows/)).toBeInTheDocument();
    });
  });

  it("opens the confirm dialog for the clicked row", async () => {
    server.use(
      listHandler({
        shows: [show({ id: 1951100, dj_name: "dj sue" })],
        total_in_window: 1,
        older_open_show_count: 0,
      })
    );

    renderWithProviders(<OpenShowsTable />);
    await waitFor(() => {
      expect(screen.getByTestId("open-show-end-1951100")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("open-show-end-1951100"));

    expect(await screen.findByTestId("force-end-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("force-end-dialog")).toHaveTextContent("dj sue");
  });
  it("offers Edit show details for each open show, opening the dialog on that show's title", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json([])),
      listHandler({
        shows: [show({ id: 1, show_name: "Sonamos Hour" }), show({ id: 2, show_name: "Late Set" })],
        total_in_window: 2,
        older_open_show_count: 0,
      })
    );

    const { user } = renderWithProviders(<OpenShowsTable />);

    expect(await screen.findByTestId("open-show-edit-1")).toBeInTheDocument();
    await user.click(screen.getByTestId("open-show-edit-2"));

    expect(await screen.findByText("Edit show details", { selector: "h2, h1, [id]" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Late Set");
  });
  it("refreshes the row and the next dialog open after a title is saved from the table", async () => {
    let title = "Sonamos Hour";
    const patched: unknown[] = [];
    server.use(
      http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, () =>
        HttpResponse.json({
          shows: [show({ id: 1, show_name: title })],
          total_in_window: 1,
          older_open_show_count: 0,
        })
      ),
      http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/1`, async ({ request }) => {
        const body = (await request.json()) as { show_name: string };
        patched.push(body);
        title = body.show_name;
        return HttpResponse.json({ id: 1 });
      })
    );

    const { user } = renderWithProviders(<OpenShowsTable />);
    const row = await screen.findByTestId("open-show-row-1");
    expect(row).toHaveTextContent("Sonamos Hour");

    await user.click(screen.getByTestId("open-show-edit-1"));
    const input = await screen.findByRole("textbox", { name: /title/i });
    await user.clear(input);
    await user.type(input, "Late Set");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(patched).toEqual([{ show_name: "Late Set" }]));
    await waitFor(() => expect(screen.getByTestId("open-show-row-1")).toHaveTextContent("Late Set"));
    expect(screen.getByTestId("open-show-row-1")).not.toHaveTextContent("Sonamos Hour");

    await user.click(screen.getByTestId("open-show-edit-1"));
    expect(await screen.findByRole("textbox", { name: /title/i })).toHaveValue("Late Set");
  });
  describe("the program the Edit show details dialog opens on", () => {
    const [ORANGE_COUNTY] = SEED_CATALOG;
    const RETIRED = SEED_CATALOG.find((p) => !p.active)!;

    function serveShows(shows: OpenShow[]) {
      const patched: unknown[] = [];
      server.use(
        http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(SEED_CATALOG)),
        listHandler({ shows, total_in_window: shows.length, older_open_show_count: 0 }),
        http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/:id`, async ({ request }) => {
          patched.push(await request.json());
          return HttpResponse.json({ id: 1 });
        })
      );
      return patched;
    }

    const openDialog = async (user: ReturnType<typeof renderWithProviders>["user"], id: number) => {
      await user.click(await screen.findByTestId(`open-show-edit-${id}`));
      return screen.findByRole("combobox", { name: /program/i });
    };

    it("preselects the program a tagged show carries", async () => {
      serveShows([show({ id: 1, show_name: "Sonamos Hour", specialty: ORANGE_COUNTY })]);
      const { user } = renderWithProviders(<OpenShowsTable />);

      expect(await openDialog(user, 1)).toHaveTextContent(ORANGE_COUNTY.name);
    });

    it("clears the tag with a single { specialty_id: null } when None is chosen", async () => {
      const patched = serveShows([show({ id: 1, specialty: ORANGE_COUNTY })]);
      const { user } = renderWithProviders(<OpenShowsTable />);

      await user.click(await openDialog(user, 1));
      await user.click(await screen.findByRole("option", { name: "None (freeform)" }));
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => expect(patched).toEqual([{ specialty_id: null }]));
    });

    it("preselects None for a freeform show and sends only show_name on a title-only save", async () => {
      const patched = serveShows([show({ id: 1, show_name: "Late Set", specialty: null })]);
      const { user } = renderWithProviders(<OpenShowsTable />);

      expect(await openDialog(user, 1)).toHaveTextContent("None (freeform)");
      const input = screen.getByRole("textbox", { name: /title/i });
      await user.clear(input);
      await user.type(input, "Later Set");
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => expect(patched).toEqual([{ show_name: "Later Set" }]));
    });

    it("shows a retired program as the current value", async () => {
      serveShows([show({ id: 1, specialty: RETIRED })]);
      const { user } = renderWithProviders(<OpenShowsTable />);

      expect(await openDialog(user, 1)).toHaveTextContent(RETIRED.name);
    });

    it("opens the dialog on None when the server omits specialty", async () => {
      serveShows([show({ id: 1, show_name: "Late Set" })]);
      const { user } = renderWithProviders(<OpenShowsTable />);

      expect(await openDialog(user, 1)).toHaveTextContent("None (freeform)");
    });
  });
});
