import { describe, it, expect, vi, afterEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

// The label field renders only for a music director; this form is theirs, so the gate is open here.
vi.mock("@/src/components/shared/Authorization", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  RequireMD: ({ children }: { children: React.ReactNode }) => children,
}));

import { toast } from "sonner";
import { fakeDiscogsPrefillEndpoint, MOLINA_DISCOGS_PREFILL } from "@/tests/fakes/discogsPrefill";
import IntakeLogForm from "@/src/components/experiences/modern/reviews/IntakeLogForm";

const moonPix = () => intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador" });

function captureIntakePost() {
  const sent: { body?: Record<string, unknown> } = {};
  server.use(
    http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
      sent.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(moonPix());
    }),
  );
  return sent;
}

describe("IntakeLogForm", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sends the artist, album and format of a record entered in the form", async () => {
    fakeReviewsEndpoints({ open: [] });
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "A disc or a record" }));
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "CD" }));
    await user.click(screen.getByRole("button", { name: "Add a record" }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ artist_name: "Cat Power", album_title: "Moon Pix" });
  });

  it("hands the answered record to onLogged once per add, after the server answers", async () => {
    fakeReviewsEndpoints({ open: [] });
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(moonPix())));
    const onLogged = vi.fn();

    const { user } = renderWithProviders(<IntakeLogForm onLogged={onLogged} />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "As files" }));
    await user.click(screen.getByRole("button", { name: "Add a record" }));

    await waitFor(() => expect(onLogged).toHaveBeenCalledTimes(1));
    expect(onLogged).toHaveBeenCalledWith(expect.objectContaining({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix" }), undefined);
  });

  it("never calls onLogged when the add fails", async () => {
    fakeReviewsEndpoints({ open: [] });
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    const onLogged = vi.fn();

    const { user } = renderWithProviders(<IntakeLogForm onLogged={onLogged} />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "As files" }));
    await user.click(screen.getByRole("button", { name: "Add a record" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onLogged).not.toHaveBeenCalled();
  });

  it("tells onBusyChange when the add starts and when it ends, whichever way it ends", async () => {
    fakeReviewsEndpoints({ open: [] });
    server.use(http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    const onBusyChange = vi.fn();

    const { user } = renderWithProviders(<IntakeLogForm onBusyChange={onBusyChange} />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "As files" }));
    await user.click(screen.getByRole("button", { name: "Add a record" }));

    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(onBusyChange.mock.calls.map(([busy]) => busy)).toEqual([true, false]);
  });

  it("leaves out its own heading when the host titles it, and keeps the form's name", async () => {
    fakeReviewsEndpoints({ open: [] });

    renderWithProviders(<IntakeLogForm hideTitle />);

    expect(await screen.findByRole("form", { name: "Add a record" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the Format options as CD and Vinyl while still sending the stored format's id", async () => {
    fakeReviewsEndpoints({ open: [] });
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
        HttpResponse.json([{ id: 1, format_name: "cd" }, { id: 2, format_name: "vinyl" }]),
      ),
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("radio", { name: "A disc or a record" }));
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["CD", "Vinyl"]);
    await user.click(options[1]);
    await user.click(screen.getByRole("button", { name: "Add a record" }));

    await waitFor(() => expect(body).toBeDefined());
    expect(body!.format_id).toBe(2);
  });

  describe("the arrival choice looks as chosen as it is", () => {
    // The segment's action slot carries both the raised look of a choice and Joy's focus ring.
    const segmentOf = (name: string) => screen.getByRole("radio", { name }).parentElement!;
    const isRaised = (name: string) => getComputedStyle(segmentOf(name)).boxShadow !== "";
    const isRinged = (name: string) => getComputedStyle(segmentOf(name)).outline.includes("solid");

    it("shows no option raised and keeps Add a record disabled when the form opens", async () => {
      fakeReviewsEndpoints({ open: [] });

      renderWithProviders(<IntakeLogForm />);

      for (const name of ["A disc or a record", "As files"]) {
        expect(await screen.findByRole("radio", { name })).not.toBeChecked();
        expect(isRaised(name)).toBe(false);
      }
      expect(screen.getByRole("button", { name: "Add a record" })).toBeDisabled();
    });

    it("draws no ring around an option that has keyboard focus but is not chosen, and underlines its label instead", async () => {
      fakeReviewsEndpoints({ open: [] });

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Artist/), "Juana Molina");
      await user.type(screen.getByLabelText(/^Album/), "DOGA");
      // Tab moves onto a radio without choosing it; a keypress then a focus is how jsdom reaches Joy's focus-visible state.
      const files = screen.getByRole("radio", { name: "As files" });
      await user.keyboard("{Shift}");
      act(() => files.focus());

      expect(segmentOf("As files")).toHaveClass("Mui-focusVisible");
      expect(files).not.toBeChecked();
      expect(isRaised("As files")).toBe(false);
      expect(isRinged("As files")).toBe(false);
      expect(getComputedStyle(screen.getByRole("radiogroup")).outline).toContain("solid");
      expect(getComputedStyle(screen.getByText("As files")).textDecoration).toContain("underline");
      expect(screen.getByRole("button", { name: "Add a record" })).toBeDisabled();
    });

    it("raises As files and enables Add a record once it is chosen with an artist and album", async () => {
      fakeReviewsEndpoints({ open: [] });

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Artist/), "Juana Molina");
      await user.type(screen.getByLabelText(/^Album/), "DOGA");
      await user.click(screen.getByRole("radio", { name: "As files" }));

      expect(screen.getByRole("radio", { name: "As files" })).toBeChecked();
      expect(isRaised("As files")).toBe(true);
      expect(isRaised("A disc or a record")).toBe(false);
      expect(screen.getByRole("button", { name: "Add a record" })).toBeEnabled();
    });
  });

  describe("the Bandcamp link", () => {
    it("asks a phone for its URL keyboard", async () => {
      fakeReviewsEndpoints({ open: [] });
      renderWithProviders(<IntakeLogForm />);
      expect(await screen.findByLabelText(/^Bandcamp link/)).toHaveAttribute("inputmode", "url");
    });

    it.each([
      ["a valid link is sent as bandcamp_url", "https://juanamolina.bandcamp.com/album/doga", { bandcamp_url: "https://juanamolina.bandcamp.com/album/doga" }],
      ["an empty field sends no bandcamp_url key", "", null],
      ["http is refused", "http://juanamolina.bandcamp.com/album/doga", "refused"],
      ["another site is refused", "https://example.com/bandcamp.com", "refused"],
      ["a non-URL is refused", "doga", "refused"],
      ["a link whose parsed form is over 512 characters is refused", `https://bandcamp.com/${"é".repeat(80)}${"a".repeat(12)}`, "refused"],
    ])("%s", async (_case, link, expected) => {
      fakeReviewsEndpoints({ open: [] });
      let body: Record<string, unknown> | undefined;
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(moonPix());
        }),
      );

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Artist/), "Juana Molina");
      await user.type(screen.getByLabelText(/^Album/), "DOGA");
      await user.click(screen.getByRole("radio", { name: "As files" }));
      if (link) {
        await user.type(screen.getByLabelText(/^Bandcamp link/), link);
      }
      if (expected === "refused") {
        expect(await screen.findByText("That isn't a Bandcamp link.")).toBeInTheDocument();
        expect(screen.getByLabelText(/^Bandcamp link/)).toBeInvalid();
        expect(screen.getByLabelText(/^Bandcamp link/)).toHaveAccessibleDescription("That isn't a Bandcamp link.");
        // The button is disabled; Enter in the field is the other way to submit.
        expect(screen.getByRole("button", { name: "Add a record" })).toBeDisabled();
        await user.type(screen.getByLabelText(/^Bandcamp link/), "{Enter}");
        // Give a request already on its way time to land before checking that none was made.
        await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
        expect(body).toBeUndefined();
        return;
      }
      await user.click(screen.getByRole("button", { name: "Add a record" }));
      await waitFor(() => expect(body).toBeDefined());
      if (expected == null) {
        expect(body).not.toHaveProperty("bandcamp_url");
      } else {
        expect(body).toMatchObject(expected as object);
      }
    });
  });

  describe("the label", () => {
    async function pickDragCity(user: ReturnType<typeof renderWithProviders>["user"]) {
      server.use(http.get(`${TEST_BACKEND_URL}/labels/search`, () => HttpResponse.json([{ id: 41, label_name: "Drag City" }])));
      await user.type(await screen.findByLabelText(/^Artist/), "Jessica Pratt");
      await user.type(screen.getByLabelText(/^Album/), "On Your Own Love Again");
      await user.type(screen.getByRole("combobox", { name: "Search labels" }), "Drag");
      await user.click(await screen.findByRole("option", { name: /Drag City/ }));
    }

    it.each([
      ["sends the id of a label picked from the dropdown", async () => undefined, "Drag City", 41],
      [
        "leaves out the picked label's id once the label is changed",
        async (user: ReturnType<typeof renderWithProviders>["user"]) => {
          const label = screen.getByRole("combobox", { name: "Search labels" });
          await user.clear(label);
          await user.type(label, "Sonamos");
        },
        "Sonamos",
        undefined,
      ],
    ])("%s", async (_case, edit, recordLabel, labelId) => {
      fakeReviewsEndpoints({ open: [] });
      const sent = captureIntakePost();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await pickDragCity(user);
      await edit(user);
      await user.click(screen.getByRole("radio", { name: "As files" }));
      await user.click(screen.getByRole("button", { name: "Add a record" }));

      await waitFor(() => expect(sent.body).toBeDefined());
      expect(sent.body).toMatchObject({ record_label: recordLabel });
      if (labelId === undefined) {
        expect(sent.body).not.toHaveProperty("label_id");
      } else {
        expect(sent.body).toMatchObject({ label_id: labelId });
      }
    });
  });

  describe("filling the record's details from the Discogs field", () => {
    const FILLED_LINE = "Filled in the artist, album and label from Discogs. Check them before you add the record.";
    const LINK = "https://www.discogs.com/release/24216789-Juana-Molina-DOGA";
    const OTHER_LINK = "https://www.discogs.com/release/1234567";
    type User = ReturnType<typeof renderWithProviders>["user"];
    const discogsField = () => screen.getByLabelText(/^Discogs link/);
    /** The Discogs field's status line, apart from the always-mounted, atomic hint region beside the buttons. */
    const discogsStatuses = () => screen.queryAllByRole("status").filter((el) => el.getAttribute("aria-atomic") !== "true");

    /** Holds each lookup's answer until the test lets it through with `answer(url)`. */
    function heldAnswers() {
      const waiting = new Map<string, () => void>();
      return {
        respond: (url: string) => new Promise<undefined>((resolve) => waiting.set(url, () => resolve(undefined))),
        answer: (url: string) => waiting.get(url)?.(),
      };
    }

    /** Lets a held answer reach the form, for a test that checks the answer changed nothing. */
    const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    it("makes one request for a paste followed by leaving the field, and fills the empty artist, album and label", async () => {
      fakeReviewsEndpoints({ open: [] });
      const prefill = fakeDiscogsPrefillEndpoint();
      const sent = captureIntakePost();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);
      await user.tab();

      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Artist/)).toHaveValue("Juana Molina");
      expect(screen.getByLabelText(/^Album/)).toHaveValue("DOGA");
      expect(screen.getByDisplayValue("Sonamos")).toBeInTheDocument();
      expect(prefill.urls()).toEqual([LINK]);

      await user.click(screen.getByRole("radio", { name: "As files" }));
      await user.click(screen.getByRole("button", { name: "Add a record" }));
      await waitFor(() => expect(sent.body).toBeDefined());
      expect(sent.body).toMatchObject({ record_label: "Sonamos", discogs_release_id: 24216789 });
    });

    it("leaves a field the music director already typed in alone", async () => {
      fakeReviewsEndpoints({ open: [] });
      fakeDiscogsPrefillEndpoint();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Album/), "Doga (promo)");
      await user.click(discogsField());
      await user.paste(LINK);

      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Album/)).toHaveValue("Doga (promo)");
      expect(screen.getByLabelText(/^Artist/)).toHaveValue("Juana Molina");
    });

    it("keeps what the music director types while the lookup is still running", async () => {
      fakeReviewsEndpoints({ open: [] });
      const held = heldAnswers();
      const prefill = fakeDiscogsPrefillEndpoint({ respond: held.respond });

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);
      await waitFor(() => expect(prefill.urls()).toEqual([LINK]));
      await user.type(screen.getByLabelText(/^Album/), "Doga (promo)");
      held.answer(LINK);

      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Album/)).toHaveValue("Doga (promo)");
      expect(screen.getByLabelText(/^Artist/)).toHaveValue("Juana Molina");
    });

    it("makes no request while digits are typed, and one when the field loses focus", async () => {
      fakeReviewsEndpoints({ open: [] });
      const prefill = fakeDiscogsPrefillEndpoint();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Discogs link/), "24216789");
      expect(prefill.urls()).toEqual([]);

      await user.tab();
      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(prefill.urls()).toEqual(["24216789"]);
    });

    it("looks up what the field holds after a paste into text already there, not the pasted text alone", async () => {
      fakeReviewsEndpoints({ open: [] });
      const prefill = fakeDiscogsPrefillEndpoint();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.type(await screen.findByLabelText(/^Discogs link/), "2421");
      await user.paste("6789");

      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(prefill.urls()).toEqual(["24216789"]);
    });

    it.each([
      [
        "a newer link was pasted over it",
        async (user: User) => {
          await user.tripleClick(discogsField());
          await user.paste(OTHER_LINK);
          expect(await screen.findByText("Discogs has no release for that link")).toBeInTheDocument();
        },
        "Discogs has no release for that link",
      ],
      ["the field was cleared", async (user: User) => user.clear(discogsField()), null],
    ])("ignores the answer for a link once %s", async (_case, replace, lineAfter) => {
      fakeReviewsEndpoints({ open: [] });
      const held = heldAnswers();
      const prefill = fakeDiscogsPrefillEndpoint({
        respond: (url) =>
          url === OTHER_LINK
            ? HttpResponse.json({ message: "Discogs has no release for that link", code: "release_not_found" }, { status: 404 })
            : held.respond(url),
      });

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);
      await waitFor(() => expect(prefill.urls()).toContain(LINK));
      await replace(user);
      held.answer(LINK);
      await settle();

      expect(screen.getByLabelText(/^Artist/)).toHaveValue("");
      expect(screen.getByLabelText(/^Album/)).toHaveValue("");
      expect(screen.queryByText(FILLED_LINE)).not.toBeInTheDocument();
      if (lineAfter) {
        expect(discogsStatuses()).toHaveLength(1);
        expect(discogsStatuses()[0]).toHaveTextContent(lineAfter);
      } else {
        expect(discogsStatuses()).toHaveLength(0);
      }
    });

    // The prefill's label id is the label's Discogs id, not a WXYC label: sent as `label_id` it fails the
    // labels foreign key and the add is refused. Either name Backend gives it must stay out of the request: the
    // `label_id` case is the production 400, and the `discogs_label_id` case guards the field after Backend renames it.
    it.each(["label_id", "discogs_label_id"])("sends a prefilled label by name only, never the Discogs label id it carries as %s", async (field) => {
      const prattLink = "https://www.discogs.com/release/6539468-Jessica-Pratt-On-Your-Own-Love-Again";
      fakeReviewsEndpoints({ open: [] });
      fakeDiscogsPrefillEndpoint({
        prefill: {
          ...MOLINA_DISCOGS_PREFILL,
          discogs_release_id: 6539468,
          artist_name: "Jessica Pratt",
          album_title: "On Your Own Love Again",
          label: "Drag City",
          year: 2015,
          [field]: 12345,
        },
      });
      server.use(http.get(`${TEST_BACKEND_URL}/labels/search`, () => HttpResponse.json([])));
      const sent = captureIntakePost();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(prattLink);
      expect(await screen.findByDisplayValue("Drag City")).toBeInTheDocument();
      await user.click(screen.getByRole("radio", { name: "As files" }));
      await user.click(screen.getByRole("button", { name: "Add a record" }));

      await waitFor(() => expect(sent.body).toBeDefined());
      expect(sent.body).toMatchObject({
        artist_name: "Jessica Pratt",
        album_title: "On Your Own Love Again",
        record_label: "Drag City",
        discogs_release_id: 6539468,
      });
      expect(sent.body).not.toHaveProperty("label_id");
    });

    it.each([
      ["the field is cleared", async (user: User) => user.clear(discogsField())],
      [
        "the record is added",
        async (user: User) => {
          captureIntakePost();
          await user.click(screen.getByRole("radio", { name: "As files" }));
          await user.click(screen.getByRole("button", { name: "Add a record" }));
          await waitFor(() => expect(screen.getByLabelText(/^Artist/)).toHaveValue(""));
        },
      ],
    ])("takes the line away when %s, and looks the same link up again when it is pasted again", async (_case, leave) => {
      fakeReviewsEndpoints({ open: [] });
      const prefill = fakeDiscogsPrefillEndpoint();

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);
      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();

      await leave(user);
      expect(screen.queryByText(FILLED_LINE)).not.toBeInTheDocument();

      await user.click(discogsField());
      await user.paste(LINK);
      expect(await screen.findByText(FILLED_LINE)).toBeInTheDocument();
      expect(prefill.urls()).toEqual([LINK, LINK]);
    });

    it.each([
      ["a lookup that worked", undefined, FILLED_LINE],
      [
        "a named 4xx",
        () => HttpResponse.json({ message: "Discogs has no release for that link", code: "release_not_found" }, { status: 404 }),
        "Discogs has no release for that link",
      ],
      ["a 5xx", () => HttpResponse.json({ message: "boom" }, { status: 502 }), /^Couldn't autopopulate from that link/],
    ])("announces the line for %s, ties it to the field, and keeps the form usable", async (_case, respond, line) => {
      fakeReviewsEndpoints({ open: [] });
      fakeDiscogsPrefillEndpoint({ respond });

      const { user } = renderWithProviders(<IntakeLogForm />);
      await user.click(await screen.findByLabelText(/^Discogs link/));
      await user.paste(LINK);

      await waitFor(() => expect(discogsStatuses()).toHaveLength(1));
      expect(discogsStatuses()[0]).toHaveTextContent(line);
      expect(discogsField()).toHaveAccessibleDescription(line);
      await user.clear(screen.getByLabelText(/^Album/));
      await user.type(screen.getByLabelText(/^Album/), "Doga");
      expect(screen.getByLabelText(/^Album/)).toHaveValue("Doga");
    });
  });
});
