import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
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

function getSegueCheckbox(): HTMLInputElement {
  // The Segue checkbox uses name="segueAnswer" (matching tubafrenzy).
  const el = document.querySelector(
    'input[type="checkbox"][name="segueAnswer"]'
  );
  if (!el) throw new Error("Segue checkbox not found");
  return el as HTMLInputElement;
}

function selectOtherRelease() {
  const radio = document.querySelector(
    'input[type="radio"][value="otherRelease"]'
  ) as HTMLInputElement | null;
  if (!radio) throw new Error("Other release radio not found");
  fireEvent.click(radio);
}

function setText(name: string, value: string) {
  const input = document.querySelector(
    `input[name="${name}"]`
  ) as HTMLInputElement | null;
  if (!input) throw new Error(`Input ${name} not found`);
  fireEvent.change(input, { target: { value } });
}

describe("Classic EntryForm segue checkbox", () => {
  it("renders a Segue checkbox, unchecked by default", () => {
    renderWithProviders(<EntryForm />);
    const segueCheckbox = getSegueCheckbox();
    expect(segueCheckbox.type).toBe("checkbox");
    expect(segueCheckbox.checked).toBe(false);
    // Label text "Segue" should appear in the document.
    expect(screen.getByText(/^segue$/i)).toBeDefined();
  });

  it("toggles segue state when the checkbox is clicked", () => {
    renderWithProviders(<EntryForm />);
    const segueCheckbox = getSegueCheckbox();
    fireEvent.click(segueCheckbox);
    expect(segueCheckbox.checked).toBe(true);
    fireEvent.click(segueCheckbox);
    expect(segueCheckbox.checked).toBe(false);
  });

  it("submits segue=true in the addToFlowsheet payload when the checkbox is checked", async () => {
    renderWithProviders(<EntryForm />);

    selectOtherRelease();
    setText("artistName", "Juana Molina");
    setText("songTitle", "la paradoja");
    fireEvent.click(getSegueCheckbox());

    const submit = document.querySelector(
      'input[type="submit"]'
    ) as HTMLInputElement;
    fireEvent.click(submit);

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.segue).toBe(true);
    expect(payload.track_title).toBe("la paradoja");
    expect(payload.artist_name).toBe("Juana Molina");
  });

  it("submits segue=false when the checkbox is unchecked", async () => {
    renderWithProviders(<EntryForm />);

    selectOtherRelease();
    setText("artistName", "Jessica Pratt");
    setText("songTitle", "Back, Baby");

    const submit = document.querySelector(
      'input[type="submit"]'
    ) as HTMLInputElement;
    fireEvent.click(submit);

    await waitFor(() => {
      expect(addToFlowsheetMock).toHaveBeenCalledTimes(1);
    });
    const payload = addToFlowsheetMock.mock.calls[0][0];
    expect(payload.segue).toBe(false);
  });
});
