import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import OpenShowsTable from "@/src/components/experiences/modern/admin/shows/OpenShowsTable";
import type { OpenShow } from "@/lib/features/flowsheet/types";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

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
});
