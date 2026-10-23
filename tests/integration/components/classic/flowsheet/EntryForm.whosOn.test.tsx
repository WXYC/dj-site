import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
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
        shows: showAnswers
          ? [
              {
                id: 7,
                start_time: NOON,
                specialty: specialty && { ...SEED_CATALOG[0], ...specialty },
              },
            ]
          : [],
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

async function renderForm() {
  const view = renderWithProviders(<EntryForm />);
  await waitFor(() =>
    expect(
      flowsheetApi.endpoints.getCurrentShow.select(undefined)(view.store.getState()).data
    ).not.toBeUndefined()
  );
  return view;
}

const addSelect = () => screen.getByLabelText("Add a") as HTMLSelectElement;
const optionValues = () =>
  Array.from(addSelect().options).map((o) => o.value);
const nameField = () => screen.getByRole("textbox");

describe("Classic EntryForm — who's-on role entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    specialty = null;
    showAnswers = true;
    posts = [];
    postRefusal = null;
    serve();
  });

  it("lists the five roles in menu order beside Track, Talkset and the breakpoint on a freeform set", async () => {
    await renderForm();

    await waitFor(() => expect(optionValues()).toHaveLength(8));
    expect(optionValues().slice(0, 2)).toEqual(["track", "talkset"]);
    expect(optionValues().slice(2, 7)).toEqual(WHOS_ON_ROLES.map((r) => r.role));
    expect(optionValues()[7]).toBe("breakpoint");
    expect(Array.from(addSelect().options).map((o) => o.text).slice(2, 7)).toEqual(
      WHOS_ON_ROLES.map((r) => r.menu)
    );
  });

  it.each([
    ["a program with no usual role", { default_spotlight_role: null }, true],
    ["a show that has not answered", null, false],
  ] as const)("offers no role entries on %s", async (_label, program, answers) => {
    specialty = program;
    showAnswers = answers;
    serve();
    await renderForm();

    expect(optionValues()).toEqual(["track", "talkset", "breakpoint"]);
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

    expect(await screen.findByRole("alert")).toHaveTextContent(whosOnCopy.disabled);
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
