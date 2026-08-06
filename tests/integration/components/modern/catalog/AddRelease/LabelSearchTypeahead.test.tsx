import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  onTestFinished,
} from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import LabelSearchTypeahead from "@/src/components/experiences/modern/catalog/AddRelease/LabelSearchTypeahead";
import type { LabelRow } from "@/lib/features/labels/types";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// No organization configured (the real production shape): the WXYC tier
// resolves via fetchOrganizationRoleForUserClient's JWT decode, not the raw
// session role, so every test drives that mock and awaits resolution.
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

function sessionWithRole() {
  return {
    data: {
      user: {
        id: "user-1",
        email: "test@wxyc.org",
        name: "Test User",
        username: "testuser",
        role: null,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
    },
    isPending: false,
    error: null,
  };
}

const LABEL_SEARCH_URL = `${TEST_BACKEND_URL}/labels/search`;

const sonamos: LabelRow = { id: 5, label_name: "Sonamos" };
const dragCity: LabelRow = { id: 9, label_name: "Drag City" };

/** More rows than the panel's fixed height shows, so the tail needs scrolling. */
const manyLabels: LabelRow[] = [
  "Drag City",
  "Domino",
  "Dead Oceans",
  "Duophonic",
  "Danger Crue",
  "Dischord",
  "Don Giovanni",
  "Drawing Room",
  "Dais",
  "Deathbomb Arc",
].map((label_name, index) => ({ id: 100 + index, label_name }));

type SearchResponder = (url: URL) => Response | Promise<Response>;

function mockLabelSearch(respond: LabelRow[] | SearchResponder): URL[] {
  const requests: URL[] = [];
  server.use(
    http.get(LABEL_SEARCH_URL, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return typeof respond === "function"
        ? respond(url)
        : HttpResponse.json(respond);
    }),
  );
  return requests;
}

function ControlledTypeahead({
  initialValue = "",
  onSelect = vi.fn(),
  onSelectionCleared = vi.fn(),
  disabled,
}: {
  initialValue?: string;
  onSelect?: (label: LabelRow) => void;
  onSelectionCleared?: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <LabelSearchTypeahead
      value={value}
      onChange={setValue}
      onSelect={onSelect}
      onSelectionCleared={onSelectionCleared}
      disabled={disabled}
    />
  );
}

/**
 * The field's production home is a form, where an unhandled Enter submits.
 * Wrapping it in one is the only way to observe which key presses this
 * component lets through to that submission.
 */
function TypeaheadInForm({ onSubmit }: { onSubmit: () => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <ControlledTypeahead />
    </form>
  );
}

/**
 * The field's production home is also inside a dialog that closes on Escape and
 * discards the form with it. Only an enclosing handler can observe whether an
 * Escape aimed at the suggestion panel also reaches that dialog.
 */
function TypeaheadUnderEscapeHandler({ onEscape }: { onEscape: () => void }) {
  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") onEscape();
      }}
    >
      <ControlledTypeahead />
    </div>
  );
}

/** A focusable neighbour, so Tab out of the field lands somewhere real. */
function TypeaheadBesideField({ onSelect }: { onSelect?: (l: LabelRow) => void }) {
  return (
    <>
      <ControlledTypeahead onSelect={onSelect} />
      <input aria-label="Catalog number" />
    </>
  );
}

/**
 * Records the element each `scrollIntoView` call targeted. jsdom runs no layout,
 * so the shared setup stubs the method and the call itself is the only
 * observable — which element it was made on is what the assertion needs.
 */
function captureScrollTargets(): Element[] {
  const targets: Element[] = [];
  const spy = vi
    .spyOn(Element.prototype, "scrollIntoView")
    .mockImplementation(function (this: Element) {
      targets.push(this);
    });
  onTestFinished(() => spy.mockRestore());
  return targets;
}

const findInput = () => screen.findByPlaceholderText("Search labels...");

describe("LabelSearchTypeahead", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The field is Music-Director-gated; every test below the permission block
    // exercises the picker itself, so MD is the default authority.
    mockFetchOrgRole.mockResolvedValue("musicDirector");
    mockUseSession.mockReturnValue(sessionWithRole());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      renderWithProviders(<ControlledTypeahead />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(
          screen.queryByPlaceholderText("Search labels..."),
        ).not.toBeInTheDocument(),
      );
    });

    it("renders the search input for a Music Director", async () => {
      renderWithProviders(<ControlledTypeahead />);

      expect(await findInput()).toBeInTheDocument();
    });
  });

  describe("querying", () => {
    it("issues one debounced request", async () => {
      const requests = mockLabelSearch([sonamos]);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Sona");

      expect(requests).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(400);
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0].searchParams.get("q")).toBe("Sona");
    });

    it("does not query below the minimum query length", async () => {
      const requests = mockLabelSearch([sonamos]);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "S");
      await vi.advanceTimersByTimeAsync(400);

      expect(requests).toHaveLength(0);
    });

    it("does not query for a seeded value until the panel is opened", async () => {
      const requests = mockLabelSearch([sonamos]);
      renderWithProviders(<ControlledTypeahead initialValue="Sonamos" />);

      await findInput();
      await vi.advanceTimersByTimeAsync(400);

      expect(requests).toHaveLength(0);
    });

    it("renders matching results", async () => {
      mockLabelSearch([sonamos]);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);

      expect(await screen.findByText("Sonamos")).toBeInTheDocument();
    });

    it("tells the MD a new label will be created when nothing matches", async () => {
      mockLabelSearch([]);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Nonexistent Label");
      await vi.advanceTimersByTimeAsync(400);

      expect(
        await screen.findByText(/will be created as a new label/i),
      ).toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("calls onSelect with the full label on click and writes its name into the field", async () => {
      mockLabelSearch([sonamos, dragCity]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead onSelect={onSelect} />,
      );

      const input = await findInput();
      await user.type(input, "So");
      await vi.advanceTimersByTimeAsync(400);

      await user.click(await screen.findByText("Sonamos"));

      expect(onSelect).toHaveBeenCalledWith(sonamos);
      expect(input).toHaveValue("Sonamos");
    });

    it("closes the panel on Escape", async () => {
      mockLabelSearch([sonamos]);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("listbox");

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    // Dismissing a suggestion list and discarding a half-filled release form
    // are different intents that arrive as the same key. The enclosing dialog's
    // handler does not consult defaultPrevented, so only stopping propagation
    // keeps the first from costing the MD the second.
    it("keeps an Escape aimed at the panel away from an enclosing handler", async () => {
      mockLabelSearch([sonamos]);
      const onEscape = vi.fn();
      const { user } = renderWithProviders(
        <TypeaheadUnderEscapeHandler onEscape={onEscape} />,
      );

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("listbox");

      await user.keyboard("{Escape}");

      expect(onEscape).not.toHaveBeenCalled();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

      // With no panel to dismiss the key is the enclosing handler's, and the
      // same press reaches it — so the assertion above is about this component
      // swallowing the event, not about the handler being unreachable.
      await user.click(input);
      await user.clear(input);
      await user.keyboard("{Escape}");

      expect(onEscape).toHaveBeenCalledTimes(1);
    });
  });

  describe("focus", () => {
    // The panel is stacked above the rest of the form, so one left standing
    // after a Tab covers the field the MD just moved into — and its Escape
    // dismissal is no longer reachable from there.
    it("closes the panel when focus leaves the field", async () => {
      mockLabelSearch([sonamos]);
      const { user } = renderWithProviders(<TypeaheadBesideField />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("listbox");

      await user.tab();

      expect(screen.getByLabelText("Catalog number")).toHaveFocus();
      await waitFor(() =>
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
      );
    });

    // The retry button is the error panel's only recovery affordance, and Tab
    // is the only way a keyboard reaches it. Closing on focus-out has to be
    // scoped to focus leaving the field entirely, not merely leaving the input,
    // or the button unmounts on the very keystroke that would reach it.
    it("keeps the panel open when focus moves to the retry button", async () => {
      mockLabelSearch(() =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      );
      const { user } = renderWithProviders(<TypeaheadBesideField />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("alert");

      await user.tab();

      expect(screen.getByRole("button", { name: /try again/i })).toHaveFocus();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Rows suppress the focus shift on mousedown for exactly this reason: the
    // focus-out close must not fire between mousedown and click and take the
    // row away before its selection handler runs.
    it("still selects a row clicked while the panel is open", async () => {
      mockLabelSearch([sonamos]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <TypeaheadBesideField onSelect={onSelect} />,
      );

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);

      await user.click(await screen.findByText("Sonamos"));

      expect(onSelect).toHaveBeenCalledWith(sonamos);
      expect(input).toHaveValue("Sonamos");
    });
  });

  describe("keyboard selection", () => {
    it("navigates results with the arrow keys and picks with Enter", async () => {
      mockLabelSearch([sonamos, dragCity]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead onSelect={onSelect} />,
      );

      const input = await findInput();
      await user.type(input, "Dra");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText("Drag City");

      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{ArrowDown}{Enter}");

      expect(onSelect).toHaveBeenCalledWith(dragCity);
      expect(input).toHaveValue("Drag City");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("holds the highlight on the last row rather than wrapping", async () => {
      mockLabelSearch([sonamos, dragCity]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead onSelect={onSelect} />,
      );

      const input = await findInput();
      await user.type(input, "So");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText("Drag City");

      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

      expect(onSelect).toHaveBeenCalledWith(dragCity);
    });

    it("does not act on Enter in a panel opened without navigating", async () => {
      mockLabelSearch([sonamos]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead initialValue="Sonamos" onSelect={onSelect} />,
      );

      // A seeded field opened by click, never typed into: nothing has reset the
      // highlight, so its initial value is the only thing keeping Enter from
      // acting on a row the MD never chose.
      const input = await findInput();
      await user.click(input);
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("listbox");

      await user.keyboard("{Enter}");

      expect(onSelect).not.toHaveBeenCalled();
    });

    // The panel is a fixed-height scroller holding more rows than it shows, so
    // a highlight arrowed past the fold is reachable but invisible — and Enter
    // would commit a label the MD never saw.
    it("scrolls the highlighted row into view", async () => {
      const scrolled = captureScrollTargets();
      mockLabelSearch(manyLabels);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Dr");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText("Deathbomb Arc");

      await user.keyboard("{ArrowDown}".repeat(manyLabels.length));

      const options = screen.getAllByRole("option");
      expect(scrolled.at(-1)).toBe(options[manyLabels.length - 1]);
    });

    it("does not scroll while nothing is highlighted", async () => {
      const scrolled = captureScrollTargets();
      mockLabelSearch(manyLabels);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Dr");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText("Deathbomb Arc");

      expect(scrolled).toHaveLength(0);
    });

    // A hovered row is already under the cursor. Scrolling it flush would slide
    // a different row beneath a cursor that never moved, and that row's own
    // hover would move the highlight again.
    it("does not scroll a row the pointer moved the highlight onto", async () => {
      const scrolled = captureScrollTargets();
      mockLabelSearch(manyLabels);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Dr");
      await vi.advanceTimersByTimeAsync(400);

      await user.hover(await screen.findByText("Deathbomb Arc"));

      expect(screen.getAllByRole("option").at(-1)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(scrolled).toHaveLength(0);
    });

    // The MD means the text they typed even though it prefixes an existing
    // label. With no create row for the keyboard to land on, an Enter that did
    // nothing at all would leave Escape as the only way forward — so the first
    // press dismisses the matches it has now been shown, and the second submits.
    it("dismisses the matches on Enter with nothing highlighted, then submits", async () => {
      mockLabelSearch([dragCity]);
      const onSubmit = vi.fn();
      const { user } = renderWithProviders(<TypeaheadInForm onSubmit={onSubmit} />);

      const input = await findInput();
      await user.type(input, "Drag");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("listbox");

      await user.keyboard("{Enter}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();

      await user.keyboard("{Enter}");

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("names the highlighted row in aria-activedescendant", async () => {
      mockLabelSearch([sonamos, dragCity]);
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "So");
      await vi.advanceTimersByTimeAsync(400);
      const [firstOption, secondOption] = await screen.findAllByRole("option");

      expect(input).not.toHaveAttribute("aria-activedescendant");

      await user.keyboard("{ArrowDown}");
      expect(input).toHaveAttribute("aria-activedescendant", firstOption.id);
      expect(firstOption).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{ArrowDown}");
      expect(input).toHaveAttribute("aria-activedescendant", secondOption.id);
    });

    it("clears the highlight when the panel is closed by clicking away", async () => {
      mockLabelSearch([sonamos]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead onSelect={onSelect} />,
      );

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText("Sonamos");
      await user.keyboard("{ArrowDown}");

      await user.click(document.body);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

      await user.click(input);
      await screen.findByRole("listbox");
      await user.keyboard("{Enter}");

      expect(onSelect).not.toHaveBeenCalled();
    });

    // The backend upserts on the exact label name, so a submission that
    // outruns the search creates the near-duplicate this field exists to
    // prevent. Enter is only allowed through once the search has an answer.
    it("swallows Enter while the search is still in flight", async () => {
      mockLabelSearch([sonamos]);
      const onSubmit = vi.fn();
      const { user } = renderWithProviders(<TypeaheadInForm onSubmit={onSubmit} />);

      const input = await findInput();
      await user.type(input, "Sona");
      await screen.findByText(/Searching labels/i);

      await user.keyboard("{Enter}");

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("swallows Enter while the search is reporting a failure", async () => {
      mockLabelSearch(() =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      );
      const onSubmit = vi.fn();
      const { user } = renderWithProviders(<TypeaheadInForm onSubmit={onSubmit} />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("alert");

      await user.keyboard("{Enter}");

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("lets Enter through once the search has confirmed there is no match", async () => {
      mockLabelSearch([]);
      const onSubmit = vi.fn();
      const { user } = renderWithProviders(<TypeaheadInForm onSubmit={onSubmit} />);

      const input = await findInput();
      await user.type(input, "Tubafrenzy Sound");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText(/will be created as a new label/i);

      // The answer is in and it is "nothing to collide with", so there is
      // nothing left for the panel to protect the MD from.
      await user.keyboard("{Enter}");

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not pick a row on Enter before results have arrived", async () => {
      mockLabelSearch([sonamos]);
      const onSelect = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead onSelect={onSelect} />,
      );

      const input = await findInput();
      await user.type(input, "Sona");

      // Still inside the debounce window: no row exists to act on.
      await user.keyboard("{ArrowDown}{Enter}");

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("retracting a selection", () => {
    it("retracts the picked label once the text is edited away from it", async () => {
      mockLabelSearch([sonamos]);
      const onSelectionCleared = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead onSelectionCleared={onSelectionCleared} />,
      );

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await user.click(await screen.findByText("Sonamos"));

      expect(onSelectionCleared).not.toHaveBeenCalled();

      await user.type(input, "s");

      expect(onSelectionCleared).toHaveBeenCalledTimes(1);

      await user.type(input, "x");

      expect(onSelectionCleared).toHaveBeenCalledTimes(1);
    });

    it("reports no retraction for text that was never a selection", async () => {
      mockLabelSearch([sonamos]);
      const onSelectionCleared = vi.fn();
      const { user } = renderWithProviders(
        <ControlledTypeahead onSelectionCleared={onSelectionCleared} />,
      );

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByText("Sonamos");
      await user.type(input, "mos");

      expect(onSelectionCleared).not.toHaveBeenCalled();
    });
  });

  describe("failed search", () => {
    // A gateway that answers with an HTML error page, or a route that is not
    // there, produces an unparseable body. The shared base query's default is
    // to turn that into a successful empty payload, which this picker would
    // read as "nothing to collide with" — a confirmed no-match reported at the
    // exact moment the check could not run, which is how an outage becomes the
    // duplicate label this field exists to prevent.
    it.each([
      ["a gateway HTML error page", 502],
      ["the framework's HTML 404", 404],
    ])("treats %s as a failure, not a confirmed no-match", async (_name, status) => {
      mockLabelSearch(
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Error</body></html>", {
            status,
            headers: { "Content-Type": "text/html" },
          }),
      );
      const onSubmit = vi.fn();
      const { user } = renderWithProviders(<TypeaheadInForm onSubmit={onSubmit} />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Label search is unavailable/i,
      );
      expect(
        screen.queryByText(/will be created as a new label/i),
      ).not.toBeInTheDocument();

      await user.keyboard("{Enter}");

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("reports the failure instead of implying a free-typed name is safe", async () => {
      mockLabelSearch(() =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      );
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Label search is unavailable/i,
      );
      expect(screen.queryByText(/will be created as a new label/i)).not.toBeInTheDocument();
    });

    it("retries the search on demand", async () => {
      let failNext = true;
      const requests = mockLabelSearch(() => {
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: "boom" }, { status: 500 });
        }
        return HttpResponse.json([sonamos]);
      });
      const { user } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("alert");

      await user.click(screen.getByRole("button", { name: /try again/i }));
      await vi.advanceTimersByTimeAsync(400);

      expect(await screen.findByText("Sonamos")).toBeInTheDocument();
      expect(requests).toHaveLength(2);
    });
  });

  describe("disabled", () => {
    it("neither opens nor queries", async () => {
      const requests = mockLabelSearch([sonamos]);
      renderWithProviders(<ControlledTypeahead initialValue="Sona" disabled />);

      const input = await findInput();
      expect(input).toBeDisabled();

      await vi.advanceTimersByTimeAsync(400);

      expect(requests).toHaveLength(0);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("takes down a panel that is already open when the field is disabled", async () => {
      mockLabelSearch([sonamos]);
      const { user, rerender } = renderWithProviders(<ControlledTypeahead />);

      const input = await findInput();
      await user.type(input, "Sona");
      await vi.advanceTimersByTimeAsync(400);
      await screen.findByRole("listbox");

      // A panel left standing under a greyed-out input is still clickable, and
      // one click there hands the caller a label id it is no longer allowed to
      // accept.
      rerender(<ControlledTypeahead initialValue="Sona" disabled />);

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});
