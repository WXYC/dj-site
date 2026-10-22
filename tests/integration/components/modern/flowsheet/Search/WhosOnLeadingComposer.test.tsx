import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { SpecialtyShow } from "@wxyc/shared";
import FlowsheetSearchbar from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchbar";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import {
  createTestV2SpotlightEntry,
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({ loading: false, info: { id: "u1", dj_name: "DJ Test" } }),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Search/BreakpointButton", () => ({
  default: () => null,
}));
vi.mock("@/src/components/experiences/modern/flowsheet/Search/TalksetButton", () => ({
  default: () => null,
}));

vi.mock("@/src/hooks/useGhostText", () => ({
  useGhostText: () => ({ ghostSuffix: "", acceptGhostText: () => null, trackResult: null }),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    live: true,
    searchOpen: false,
    setSearchOpen: vi.fn(),
    resetSearch: vi.fn(),
    searchQuery: { song: "", artist: "", album: "", label: "", request: false },
    setSearchProperty: vi.fn(),
    getDisplayValue: () => "",
  }),
  useFlowsheetSubmit: () => ({
    ctrlKeyPressed: false,
    handleSubmit: vi.fn(),
    submitToQueue: vi.fn(),
    binResults: [],
    catalogResults: [],
    rotationResults: [],
    lmlResults: [],
    selectedEntry: null,
  }),
}));

type Program = Partial<SpecialtyShow> | null;

let specialty: Program;
let posts: unknown[];

function serve() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json({
        entries: [],
        page: 0,
        limit: 1,
        total: 0,
        total_pages: 1,
        on_air: { dj_name: "DJ Test", show_id: 7 },
        shows: [
          {
            id: 7,
            start_time: "2026-10-18T16:30:00Z",
            specialty: specialty && { ...SEED_CATALOG[0], ...specialty },
          },
        ],
      })
    ),
    http.post(`${TEST_BACKEND_URL}/flowsheet/`, async ({ request }) => {
      posts.push(await request.json());
      return HttpResponse.json(
        createTestV2SpotlightEntry({ id: 101, show_id: 7 })
      );
    })
  );
}

async function renderBar() {
  const view = renderWithProviders(<FlowsheetSearchbar />);
  await waitFor(() =>
    expect(
      flowsheetApi.endpoints.getCurrentShow.select(undefined)(view.store.getState()).data
    ).not.toBeUndefined()
  );
  return view;
}

const roleSelect = () => screen.getByRole("combobox", { name: whosOnCopy.roleLabel });
const leading = () => screen.queryByTestId("flowsheet-whoson-leading");

describe("modern composer leading with who's on", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    specialty = { logs_playcuts: false, default_spotlight_role: "reader" };
    posts = [];
    serve();
  });

  it("leads with the program's usual role and the live DJ's handle", async () => {
    await renderBar();

    expect(await screen.findByTestId("flowsheet-whoson-leading")).toBeInTheDocument();
    expect(roleSelect()).toHaveTextContent("Reading now");
    expect(screen.getByLabelText(whosOnCopy.nameLabel("reader"))).toHaveValue("DJ Test");
    expect(screen.getByText(whosOnCopy.publicNotice("reader"))).toBeInTheDocument();
    expect(screen.queryByTestId("flowsheet-search-form")).not.toBeInTheDocument();
  });

  it("reveals the song fields from the Log a song link", async () => {
    await renderBar();
    await userEvent.click(await screen.findByRole("button", { name: "Log a song" }));

    expect(leading()).not.toBeInTheDocument();
    expect(screen.getByTestId("flowsheet-search-form")).toBeInTheDocument();
  });

  it("sends the same spotlight body as the who's-on control, with the name trimmed", async () => {
    await renderBar();
    const name = await screen.findByLabelText(whosOnCopy.nameLabel("reader"));
    await userEvent.clear(name);
    await userEvent.type(name, "  Ada Limón ");
    await userEvent.click(screen.getByRole("button", { name: whosOnCopy.add }));

    await waitFor(() =>
      expect(posts).toEqual([
        { entry_type: "spotlight", spotlight_role: "reader", spotlight_name: "Ada Limón" },
      ])
    );
  });

  it("keeps Add disabled on a blank name", async () => {
    await renderBar();
    const name = await screen.findByLabelText(whosOnCopy.nameLabel("reader"));
    await userEvent.clear(name);

    expect(screen.getByRole("button", { name: whosOnCopy.add })).toBeDisabled();
  });

  it.each([
    ["a song-logging program", { logs_playcuts: true, default_spotlight_role: "reader" }],
    ["a no-songs program with no usual role", { logs_playcuts: false, default_spotlight_role: null }],
    ["a freeform show", null],
  ] as const)("keeps today's composer for %s", async (_label, program) => {
    specialty = program as Program;
    serve();
    await renderBar();

    expect(await screen.findByTestId("flowsheet-search-form")).toBeInTheDocument();
    expect(leading()).not.toBeInTheDocument();
  });
});
