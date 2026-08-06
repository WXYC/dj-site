import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import LabelSearchTypeahead from "@/src/components/experiences/modern/catalog/AddRelease/LabelSearchTypeahead";
import type { LabelRow } from "@/lib/features/labels/types";

const LABEL_SEARCH_URL = `${TEST_BACKEND_URL}/labels/search`;

const sonamos: LabelRow = { id: 5, label_name: "Sonamos" };
const dragCity: LabelRow = { id: 9, label_name: "Drag City" };

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

const findInput = () => screen.findByPlaceholderText("Search labels...");

describe("LabelSearchTypeahead", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
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
