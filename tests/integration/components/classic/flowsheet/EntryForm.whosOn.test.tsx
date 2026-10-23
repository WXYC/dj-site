import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import type { SpecialtyShow } from "@wxyc/shared";
import EntryForm from "@/src/components/experiences/classic/flowsheet/EntryForm";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { WHOS_ON_ROLES, whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import {
  createTestV2SpotlightEntry,
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));

const NOON = "2026-10-18T16:30:00Z";

type Program = Pick<SpecialtyShow, "default_spotlight_role"> | null;

let specialty: Program;
let showAnswers: boolean;
let showPending: boolean;
let posts: unknown[];
let postRefusal: { status: number; body: Record<string, string> } | null;

function serve() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
      if (showPending) {
        await delay("infinite");
      }
      return HttpResponse.json({
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
        shows: showAnswers
          ? [
              {
                id: 7,
                start_time: NOON,
                specialty: specialty && { ...SEED_CATALOG[0], ...specialty },
              },
            ]
          : [],
      });
    }),
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

async function renderForm() {
  const view = renderWithProviders(<EntryForm />);
  await waitFor(() =>
    expect(
      flowsheetApi.endpoints.getCurrentShow.select(undefined)(view.store.getState()).data
    ).not.toBeUndefined()
  );
  return view;
}

// The role entries with the usual role first and the rest in menu order.
const orderedRoles = (first: string) => [
  ...WHOS_ON_ROLES.filter((r) => r.role === first),
  ...WHOS_ON_ROLES.filter((r) => r.role !== first),
];

const addSelect = () => screen.getByLabelText("Add a") as HTMLSelectElement;
const optionValues = () =>
  Array.from(addSelect().options).map((o) => o.value);
const nameField = () => screen.getByRole("textbox");

describe("Classic EntryForm — who's-on role entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    specialty = null;
    showAnswers = true;
    showPending = false;
    posts = [];
    postRefusal = null;
    serve();
  });

  it("lists the five roles in menu order beside Track, Talkset and the breakpoint on a freeform set", async () => {
    await renderForm();

    await waitFor(() => expect(optionValues()).toHaveLength(8));
    expect(optionValues().slice(0, 2)).toEqual(["track", "talkset"]);
    expect([...optionValues().slice(2, 7)].sort()).toEqual(
      WHOS_ON_ROLES.map((r) => r.role).sort()
    );
    expect(optionValues()[7]).toBe("breakpoint");
  });

  it("offers Guest first among the role entries on a freeform set, the rest in menu order", async () => {
    await renderForm();

    await waitFor(() => expect(optionValues()).toHaveLength(8));
    expect(optionValues().slice(2, 7)).toEqual(
      orderedRoles("guest").map((r) => r.role)
    );
    expect(optionValues()[2]).toBe("guest");
    expect(Array.from(addSelect().options)[2].text).toBe(
      WHOS_ON_ROLES.find((r) => r.role === "guest")?.menu
    );
  });

  it.each(WHOS_ON_ROLES.map((r) => r.role))(
    "offers %s first on a program whose usual role it is",
    async (role) => {
      specialty = { default_spotlight_role: role };
      serve();
      await renderForm();

      await waitFor(() => expect(optionValues()).toHaveLength(8));
      expect(optionValues().slice(2, 7)).toEqual(
        orderedRoles(role).map((r) => r.role)
      );
      expect(optionValues()[2]).toBe(role);
    }
  );

  it.each([
    ["a program with no usual role", { default_spotlight_role: null }, true],
    ["a show that answered with no open show", null, false],
  ] as const)("offers no role entries on %s", async (_label, program, answers) => {
    specialty = program;
    showAnswers = answers;
    serve();
    const view = await renderForm();

    const answered = flowsheetApi.endpoints.getCurrentShow.select(undefined)(
      view.store.getState()
    ).data;
    expect(answered === null).toBe(!answers);
    expect(optionValues()).toEqual(["track", "talkset", "breakpoint"]);
  });

  it("offers no role entries while the open show has not answered", async () => {
    showPending = true;
    serve();
    const view = renderWithProviders(<EntryForm />);

    // Give the query time to start and, were it to answer, to be seen.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const state = flowsheetApi.endpoints.getCurrentShow.select(undefined)(
      view.store.getState()
    );
    expect(state.data).toBeUndefined();
    expect(state.status).toBe("pending");
    expect(optionValues()).toEqual(["track", "talkset", "breakpoint"]);
  });

  it("withdraws the name field and Add when the show stops offering the roles while one is selected", async () => {
    const view = await renderForm();
    await waitFor(() => expect(optionValues()).toContain("guest"));
    await userEvent.selectOptions(addSelect(), "guest");
    await userEvent.type(nameField(), "Jessica Pratt");
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();

    specialty = { default_spotlight_role: null };
    serve();
    await view.store.dispatch(
      flowsheetApi.endpoints.getCurrentShow.initiate(undefined, { forceRefetch: true })
    );

    await waitFor(() =>
      expect(optionValues()).toEqual(["track", "talkset", "breakpoint"])
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    // Back on Track: only the track form's own Add, still empty and disabled.
    expect(screen.getByLabelText("Song")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(addSelect().value).toBe("track");
  });

  it("offers the roles on a program with a usual role", async () => {
    specialty = { default_spotlight_role: "reader" };
    serve();
    await renderForm();

    await waitFor(() => expect(optionValues()).toContain("reader"));
  });

  it.each(WHOS_ON_ROLES.map((r) => [r.role, r.menu] as const))(
    "sends exactly the spotlight body for %s with the trimmed name, and will not send an empty one",
    async (role) => {
      await renderForm();
      await waitFor(() => expect(optionValues()).toContain(role));
      await userEvent.selectOptions(addSelect(), role);

      const add = screen.getByRole("button", { name: "Add" });
      expect(add).toBeDisabled();
      await userEvent.type(nameField(), "   ");
      expect(add).toBeDisabled();
      await userEvent.type(nameField(), "  Ada Limón ");
      await userEvent.click(add);

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toStrictEqual({
        entry_type: "spotlight",
        spotlight_role: role,
        spotlight_name: "Ada Limón",
      });
    }
  );

  it.each([
    ["performer", "Name", "This name shows in the listener apps."],
    ["dj", "The name they DJ under", "This name shows in the listener apps."],
    [
      "guest",
      "Name",
      "This name shows in the listener apps. Use the name your guest wants public.",
    ],
  ] as const)("under %s the name field is labelled %s with the public-name line", async (role, label, notice) => {
    await renderForm();
    await waitFor(() => expect(optionValues()).toContain(role));
    await userEvent.selectOptions(addSelect(), role);

    expect(screen.getByLabelText(label)).toBe(nameField());
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  it("answers a spotlight_disabled 403 with one line, no row left behind and no toast, and clears it on select change", async () => {
    postRefusal = { status: 403, body: { code: "spotlight_disabled", message: "off" } };
    serve();
    const view = await renderForm();
    await view.store.dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate()).unwrap?.();
    await waitFor(() => expect(optionValues()).toContain("guest"));
    await userEvent.selectOptions(addSelect(), "guest");

    await userEvent.type(nameField(), "Jessica Pratt");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    const refusal = await screen.findByRole("alert");
    expect(refusal).toHaveTextContent(whosOnCopy.disabled);
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "aria-describedby",
      refusal.id
    );
    expect(refusal.id).not.toBe("");
    const cached = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
      view.store.getState()
    ).data;
    expect(cached?.pages.flat().map((e) => e.entry_type)).toEqual(["track"]);
    expect(toastError).not.toHaveBeenCalled();

    await userEvent.selectOptions(addSelect(), "host");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never says spotlight to the DJ", async () => {
    await renderForm();
    await waitFor(() => expect(optionValues()).toContain("guest"));
    await userEvent.selectOptions(addSelect(), "guest");

    expect(document.body.textContent?.toLowerCase()).not.toContain("spotlight");
  });
});
