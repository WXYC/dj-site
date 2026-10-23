import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import RequestLineControl from "@/src/components/experiences/modern/RequestLineControl";
import EditShowDetailsDialog from "@/src/components/experiences/modern/EditShowDetailsDialog";
import { CLOSED_SHOW_SENTENCE } from "@/lib/features/show-playlist/api";
import { SHOW_DETAILS_REFUSED_SENTENCE } from "@/lib/features/specialty/copy";
import { requestLineCopy } from "@/lib/features/flowsheet/request-line-copy";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("sonner")>()),
  toast: { error: vi.fn() },
}));

const SHOW_ID = 7;

type RequestLine = { mode: string; source: string } | undefined;

function serve(request_line: RequestLine, spotlightRole?: string, specialty = null as unknown) {
  const bodies: unknown[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(SEED_CATALOG)),
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json({
        entries: [],
        page: 0,
        limit: 1,
        total: 0,
        total_pages: 1,
        on_air: {
          dj_name: "DJ Test",
          show_id: SHOW_ID,
          request_line,
          spotlight: spotlightRole ? { spotlight_role: spotlightRole } : null,
        },
        shows: [{ id: SHOW_ID, start_time: "2026-10-18T16:30:00Z", specialty, show_name: null }],
      })
    ),
    http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/${SHOW_ID}`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({});
    })
  );
  return bodies;
}

const select = () => screen.findByRole("combobox", { name: requestLineCopy.label });

describe("RequestLineControl explanation", () => {
  it.each([
    ["dj", "closed", undefined, requestLineCopy.sources.dj],
    ["program", "feedback", undefined, requestLineCopy.sources.program],
    ["spotlight", "closed", "performer", "Closed while a band is on."],
    ["spotlight", "closed", "reader", "Closed while a reader is on."],
    ["spotlight", "closed", undefined, requestLineCopy.spotlightClosed(undefined)],
    ["default", "requests", undefined, null],
  ])("explains source %s (%s, role %s)", async (source, mode, role, sentence) => {
    serve({ mode, source }, role);
    renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    await select();
    if (sentence) {
      expect(await screen.findByText(sentence)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/chose|usual setting|Closed while/)).not.toBeInTheDocument();
    }
  });

  it("shows an unknown mode as Requests", async () => {
    serve({ mode: "sideways", source: "default" });
    renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    expect(await select()).toHaveTextContent(requestLineCopy.modes.requests);
  });

  it.each([
    ["no request line reported", undefined, SHOW_ID],
    ["another show", { mode: "requests", source: "default" }, 99],
  ])("renders nothing for %s", async (_what, line, showId) => {
    serve(line);
    renderWithProviders(<RequestLineControl showId={showId} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("RequestLineControl descriptions", () => {
  it.each([
    ["requests", "Listeners can ask for songs and send notes."],
    ["feedback", "Listeners can send notes, with no song lookup."],
    ["closed", "Listeners can send nothing, and the Request button is hidden."],
  ])("describes %s as the selected choice, and in the list", async (mode, sentence) => {
    expect(requestLineCopy.descriptions[mode as keyof typeof requestLineCopy.descriptions]).toBe(
      sentence
    );
    serve({ mode, source: "default" });
    const { user } = renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    const combobox = await select();
    const helper = (await screen.findAllByText(sentence)).find((el) => !el.closest("[role=option]"));
    expect(helper).toBeVisible();
    expect(combobox).toHaveAccessibleDescription(sentence);

    await user.click(combobox);
    const listbox = await screen.findByRole("listbox");
    for (const [value, description] of Object.entries(requestLineCopy.descriptions)) {
      const option = within(listbox).getByRole("option", {
        name: requestLineCopy.modes[value as keyof typeof requestLineCopy.modes],
      });
      expect(option).toHaveAccessibleDescription(description);
      expect(within(option).getByText(description)).toBeInTheDocument();
    }
  });

  it("describes an unknown mode as Requests", async () => {
    serve({ mode: "sideways", source: "default" });
    renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    expect(await select()).toHaveAccessibleDescription(requestLineCopy.descriptions.requests);
  });
});

describe("request-line wording", () => {
  const strings = (value: unknown): string[] => {
    if (typeof value === "string") {
      return [value];
    }
    if (typeof value === "function") {
      return [undefined, null, "performer", "reader"].flatMap((role) =>
        strings((value as (role: unknown) => unknown)(role))
      );
    }
    return value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
  };

  it("never says spotlight to a DJ", () => {
    const all = strings(requestLineCopy);
    expect(all.length).toBeGreaterThan(8);
    expect(all.filter((text) => /spotlight/i.test(text))).toEqual([]);
  });

  it("closes for a guest in plain words", () => {
    expect(requestLineCopy.spotlightClosed(undefined)).toBe("Closed while a guest is on.");
  });

  it("renders no spotlight text for a spotlight source", async () => {
    serve({ mode: "closed", source: "spotlight" });
    const { container } = renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    await screen.findByText(requestLineCopy.spotlightClosed(undefined));
    expect(container.textContent).not.toMatch(/spotlight/i);
  });
});

describe("RequestLineControl changes", () => {
  it.each([
    ["Requests", { mode: "closed", source: "dj" }, { request_mode: "requests" }],
    ["Messages only", { mode: "requests", source: "default" }, { request_mode: "feedback" }],
    ["Closed", { mode: "requests", source: "default" }, { request_mode: "closed" }],
    ["Back to the usual", { mode: "closed", source: "dj" }, { request_mode: null }],
  ])("choosing %s sends only request_mode", async (name, line, body) => {
    const bodies = serve(line);
    const { user } = renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    await user.click(await select());
    await user.click(await screen.findByRole("option", { name }));

    await vi.waitFor(() => expect(bodies).toEqual([body]));
  });

  it("offers Back to the usual only when the DJ chose", async () => {
    serve({ mode: "requests", source: "default" });
    const { user } = renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    await user.click(await select());
    await screen.findByRole("option", { name: "Closed" });
    expect(screen.queryByRole("option", { name: "Back to the usual" })).not.toBeInTheDocument();
  });

  it("confirms Messages only, and not the other choices", async () => {
    serve({ mode: "requests", source: "default" });
    const { user } = renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    await user.click(await select());
    await user.click(await screen.findByRole("option", { name: "Messages only" }));
    expect(await screen.findByText(requestLineCopy.messagesConfirmed)).toBeInTheDocument();

    await user.click(await select());
    await user.click(await screen.findByRole("option", { name: "Closed" }));
    await vi.waitFor(() =>
      expect(screen.queryByText(requestLineCopy.messagesConfirmed)).not.toBeInTheDocument()
    );
  });

  it.each([
    ["a 400", 400, { message: "Bad request_mode" }, SHOW_DETAILS_REFUSED_SENTENCE],
    ["a closed_show 403", 403, { code: "closed_show" }, CLOSED_SHOW_SENTENCE],
  ])("%s leaves the server's value and shows one sentence", async (_what, status, body, sentence) => {
    serve({ mode: "requests", source: "default" });
    server.use(
      http.patch(`${TEST_BACKEND_URL}/flowsheet/shows/${SHOW_ID}`, () =>
        HttpResponse.json(body, { status })
      )
    );
    const { user } = renderWithProviders(<RequestLineControl showId={SHOW_ID} />);

    await user.click(await select());
    await user.click(await screen.findByRole("option", { name: "Closed" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
    expect(await select()).toHaveTextContent(requestLineCopy.modes.requests);
    expect(screen.queryByText(requestLineCopy.messagesConfirmed)).not.toBeInTheDocument();
  });
});

describe("where the control renders", () => {
  it("is inside Edit show details", async () => {
    serve({ mode: "requests", source: "default" });
    renderWithProviders(
      <EditShowDetailsDialog
        showId={SHOW_ID}
        specialty={null}
        showName={null}
        startTime="2026-10-26T15:00:00Z"
        onClose={() => {}}
      />
    );

    expect(await select()).toHaveTextContent(requestLineCopy.modes.requests);
  });
});
