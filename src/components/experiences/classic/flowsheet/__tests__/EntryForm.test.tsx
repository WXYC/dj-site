import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import EntryForm from "../EntryForm";

// The form calls useAddToFlowsheetMutation() directly; mock that hook so we can
// assert what payload the form would submit, without standing up a real server.
const addToFlowsheetMock = vi.fn();
vi.mock("@/lib/features/flowsheet/api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/features/flowsheet/api")
  >();
  return {
    ...actual,
    useAddToFlowsheetMutation: () => [
      addToFlowsheetMock,
      { isLoading: false },
    ],
  };
});

// Rotation data is irrelevant for these tests; return an empty list so the
// rotation dropdown rows do not need a fixture.
vi.mock("@/lib/features/rotation/api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/features/rotation/api")
  >();
  return {
    ...actual,
    useGetRotationQuery: () => ({ data: [] as never[] }),
  };
});

beforeEach(() => {
  addToFlowsheetMock.mockReset();
  // Default: addToFlowsheet returns a mock RTK Query result with .unwrap()
  // that resolves so the form's reset path doesn't throw.
  addToFlowsheetMock.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

/**
 * The Classic form is a port of the tubafrenzy JSP layout: every form control
 * has a `name=` but most inputs (artist textbox, release-type radios) sit next
 * to plain-text labels in adjacent `<td>` cells rather than associated `<label
 * htmlFor>` elements, so RTL's accessible-name lookups (`getByRole("textbox",
 * { name })`, `getByRole("radio", { name })`) cannot find them. We use the
 * named-control helper below for those inputs. The Segue checkbox itself is
 * wrapped in a `<label>` and is queried via `getByRole("checkbox", { name })`.
 */
function getNamedInput(name: string): HTMLInputElement {
  const el = document.querySelector(
    `input[name="${name}"]`
  ) as HTMLInputElement | null;
  if (!el) throw new Error(`Input name="${name}" not found`);
  return el;
}

describe("Classic EntryForm segue checkbox", () => {
  it("renders a Segue checkbox, unchecked by default", () => {
    renderWithProviders(<EntryForm />);
    const segueCheckbox = screen.getByRole("checkbox", {
      name: /segue/i,
    }) as HTMLInputElement;
    expect(segueCheckbox.checked).toBe(false);
  });

  it("toggles segue state when the checkbox is clicked", async () => {
    const { user } = renderWithProviders(<EntryForm />);
    const segueCheckbox = screen.getByRole("checkbox", {
      name: /segue/i,
    }) as HTMLInputElement;
    await user.click(segueCheckbox);
    expect(segueCheckbox.checked).toBe(true);
    await user.click(segueCheckbox);
    expect(segueCheckbox.checked).toBe(false);
  });

  it("submits segue=true in the addToFlowsheet payload when the checkbox is checked", async () => {
    const { user } = renderWithProviders(<EntryForm />);

    // Switch to the "Other" release type so the artist textbox renders.
    const otherRadio = document.querySelector(
      'input[name="releaseType"][value="otherRelease"]'
    ) as HTMLInputElement;
    await user.click(otherRadio);

    await user.type(getNamedInput("artistName"), "Juana Molina");
    await user.type(getNamedInput("songTitle"), "la paradoja");
    await user.click(screen.getByRole("checkbox", { name: /segue/i }));

    await user.click(
      screen.getByRole("button", { name: /add this song to the flowsheet/i })
    );

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.segue).toBe(true);
    expect(payload.track_title).toBe("la paradoja");
    expect(payload.artist_name).toBe("Juana Molina");
  });

  it("submits segue=false when the checkbox is unchecked", async () => {
    const { user } = renderWithProviders(<EntryForm />);

    const otherRadio = document.querySelector(
      'input[name="releaseType"][value="otherRelease"]'
    ) as HTMLInputElement;
    await user.click(otherRadio);

    await user.type(getNamedInput("artistName"), "Jessica Pratt");
    await user.type(getNamedInput("songTitle"), "Back, Baby");

    await user.click(
      screen.getByRole("button", { name: /add this song to the flowsheet/i })
    );

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.segue).toBe(false);
  });
});
