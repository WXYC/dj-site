import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { SpecialtyShow } from "@wxyc/shared";
import WhosOnButton from "@/src/components/experiences/modern/flowsheet/Search/WhosOnButton";
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

let mockLive = true;
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({ live: mockLive }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));

const NOON = "2026-10-18T16:30:00Z";

type Program = Pick<SpecialtyShow, "default_spotlight_role"> | null;

let specialty: Program;
let posts: unknown[];
let postRefusal: { status: number; body: Record<string, string> } | null;

function serve() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json({
        entries: [
          {
            id: 100,
            play_order: 1,
            show_id: 7,
            request_flag: false,
            entry_type: "track",
            artist_name: "Juana Molina",
            album_title: "DOGA",
            track_title: "la paradoja",
            record_label: "Sonamos",
            rotation_play_freq: null,
            add_time: NOON,
          },
        ],
        page: 0,
        limit: 1,
        total: 1,
        total_pages: 1,
        on_air: { dj_name: "DJ Test", show_id: 7 },
        shows: [
          {
            id: 7,
            start_time: NOON,
            specialty: specialty && { ...SEED_CATALOG[0], ...specialty },
          },
        ],
      })
    ),
    http.post(`${TEST_BACKEND_URL}/flowsheet/`, async ({ request }) => {
      posts.push(await request.json());
      return postRefusal
        ? HttpResponse.json(postRefusal.body, { status: postRefusal.status })
        : HttpResponse.json(
            createTestV2SpotlightEntry({
              id: 101,
              show_id: 7,
              ...((posts.at(-1) as object) ?? {}),
            })
          );
    })
  );
}

async function renderControl() {
  const view = renderWithProviders(<WhosOnButton />);
  await waitFor(() =>
    expect(
      flowsheetApi.endpoints.getCurrentShow.select(undefined)(view.store.getState()).data
    ).not.toBeUndefined()
  );
  return view;
}

const openDialog = async () => {
  await userEvent.click(screen.getByTestId("flowsheet-whoson-button"));
  return screen.findByRole("dialog");
};

const roleSelect = () => screen.getByRole("combobox", { name: whosOnCopy.roleLabel });

describe("WhosOnButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLive = true;
    specialty = null;
    posts = [];
    postRefusal = null;
    serve();
  });

  it("is a Guest button on a freeform set, and opens on Guest", async () => {
    await renderControl();

    expect(screen.getByTestId("flowsheet-whoson-button")).toBeEnabled();
    await openDialog();
    expect(roleSelect()).toHaveTextContent("Guest");
  });

  it.each([
    ["performer", "Live in the studio"],
    ["reader", "Reading now"],
    ["dj", "Now mixing"],
    ["guest", "Guest"],
    ["host", "Host"],
  ] as const)(
    "preselects a program's usual role, %s, in the role menu",
    async (role, label) => {
      specialty = { default_spotlight_role: role };
      serve();
      await renderControl();
      await openDialog();

      expect(roleSelect()).toHaveTextContent(label);
    }
  );

  it.each([
    ["has no usual role", { default_spotlight_role: null }],
    ["leaves the role off", {}],
  ] as const)("has no button on a program that %s", async (_label, program) => {
    specialty = program;
    serve();
    await renderControl();

    expect(screen.queryByTestId("flowsheet-whoson-button")).not.toBeInTheDocument();
  });

  it("offers nothing until the open show has answered", () => {
    renderWithProviders(<WhosOnButton />);

    expect(screen.queryByTestId("flowsheet-whoson-button")).not.toBeInTheDocument();
  });

  it("is disabled while the DJ is not on the air", async () => {
    mockLive = false;
    await renderControl();

    expect(screen.getByTestId("flowsheet-whoson-button")).toBeDisabled();
  });

  it("sends exactly the spotlight body for the chosen role and the trimmed name, with no track fields", async () => {
    specialty = { default_spotlight_role: "reader" };
    serve();
    await renderControl();
    const dialog = await openDialog();

    await userEvent.type(within(dialog).getByRole("textbox"), "  Ada Limón ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toStrictEqual({
      entry_type: "spotlight",
      spotlight_role: "reader",
      spotlight_name: "Ada Limón",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps its submit from reaching the searchbar's form around it", async () => {
    const searchbarSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    renderWithProviders(
      <form onSubmit={searchbarSubmit}>
        <WhosOnButton />
      </form>
    );
    await waitFor(() =>
      expect(screen.getByTestId("flowsheet-whoson-button")).toBeInTheDocument()
    );
    const dialog = await openDialog();

    await userEvent.type(within(dialog).getByRole("textbox"), "Static Cling");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(searchbarSubmit).not.toHaveBeenCalled();
  });

  it("writes the role the DJ picks over the preselected one", async () => {
    await renderControl();
    const dialog = await openDialog();

    await userEvent.click(roleSelect());
    await userEvent.click(await screen.findByRole("option", { name: "Now mixing" }));
    await userEvent.type(within(dialog).getByRole("textbox"), "Static Cling");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ spotlight_role: "dj", spotlight_name: "Static Cling" });
  });

  it("will not add a row without a name", async () => {
    await renderControl();
    const dialog = await openDialog();

    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox"), "   ");
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it.each([
    ["performer", "Name", "This name shows in the listener apps."],
    ["reader", "Name", "This name shows in the listener apps."],
    ["dj", "The name they DJ under", "This name shows in the listener apps."],
    [
      "guest",
      "Name",
      "This name shows in the listener apps. Use the name your guest wants public.",
    ],
    ["host", "Name", "This name shows in the listener apps."],
  ] as const)(
    "under a %s entry the name field is labelled %s and carries the public-name line",
    async (role, label, notice) => {
      specialty = { default_spotlight_role: role };
      serve();
      await renderControl();
      const dialog = await openDialog();

      expect(within(dialog).getByText(label)).toBeInTheDocument();
      expect(within(dialog).getByText(notice)).toBeInTheDocument();
    }
  );

  it("answers a spotlight_disabled 403 with one plain line, writes nothing locally and raises no toast", async () => {
    postRefusal = { status: 403, body: { code: "spotlight_disabled", message: "Spotlights are off" } };
    serve();
    const view = await renderControl();
    await view.store.dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate()).unwrap?.();
    const dialog = await openDialog();

    await userEvent.type(within(dialog).getByRole("textbox"), "Jessica Pratt");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Who's on air isn't turned on yet."
    );
    const cached = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
      view.store.getState()
    ).data;
    expect(cached?.pages.flat().map((e) => e.entry_type)).toEqual(["track"]);
    expect(toastError).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
