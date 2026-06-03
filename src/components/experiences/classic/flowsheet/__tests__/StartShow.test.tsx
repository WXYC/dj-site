import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";

// Mock useShowControl().goLive — we only care that StartShow forwards the
// trimmed Public DJ Handle as the second arg (the override) when the user
// edits it, and omits it when unchanged.
const goLiveMock = vi.fn();
let userInfoMock: { id: string; real_name?: string; dj_name?: string } | null = {
  id: "test-user-1",
  real_name: "Maura Partrick",
  dj_name: "Anonymous",
};

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ goLive: goLiveMock }),
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({ info: userInfoMock, loading: false }),
}));

vi.mock("@/src/utils/helpScreen", () => ({
  OpenHelp: vi.fn(),
}));

import StartShow from "../StartShow";

function getNamedInput(name: string): HTMLInputElement {
  const el = document.querySelector(
    `input[name="${name}"]`
  ) as HTMLInputElement | null;
  if (!el) throw new Error(`Input name="${name}" not found`);
  return el;
}

function submitForm() {
  const form = document.querySelector(
    'form[name="userpw"]'
  ) as HTMLFormElement | null;
  if (!form) throw new Error("Form not found");
  fireEvent.submit(form);
}

beforeEach(() => {
  goLiveMock.mockReset();
  userInfoMock = {
    id: "test-user-1",
    real_name: "Maura Partrick",
    dj_name: "Anonymous",
  };
});

describe("Classic StartShow — Public DJ Handle override (#694)", () => {
  it("renders the Public DJ Handle input as editable (not disabled)", () => {
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    expect(input.disabled).toBe(false);
  });

  it("initializes the Public DJ Handle with the registry's dj_name", () => {
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    expect(input.value).toBe("Anonymous");
  });

  it("initializes the Public DJ Handle to empty string when dj_name is missing", () => {
    userInfoMock = { id: "test-user-1", real_name: "Some DJ" };
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    expect(input.value).toBe("");
  });

  it("submitting after typing a new handle calls goLive with the override", () => {
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    fireEvent.change(input, { target: { value: "Aubrey Hearst" } });
    submitForm();
    expect(goLiveMock).toHaveBeenCalledTimes(1);
    expect(goLiveMock).toHaveBeenCalledWith("Aubrey Hearst");
  });

  it("trims whitespace before forwarding the override", () => {
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    fireEvent.change(input, { target: { value: "  Aubrey Hearst  " } });
    submitForm();
    expect(goLiveMock).toHaveBeenCalledWith("Aubrey Hearst");
  });

  it("submitting with the field untouched calls goLive without an override", () => {
    renderWithProviders(<StartShow />);
    submitForm();
    expect(goLiveMock).toHaveBeenCalledTimes(1);
    expect(goLiveMock).toHaveBeenCalledWith(undefined);
  });

  it("submitting with whitespace-only input calls goLive without an override", () => {
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    fireEvent.change(input, { target: { value: "   " } });
    submitForm();
    expect(goLiveMock).toHaveBeenCalledWith(undefined);
  });

  it("submitting after clearing a populated handle calls goLive without an override", () => {
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    fireEvent.change(input, { target: { value: "" } });
    submitForm();
    expect(goLiveMock).toHaveBeenCalledWith(undefined);
  });

  it("submitting when the typed handle matches the initial dj_name calls goLive without an override", () => {
    renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    // Simulate a focus/blur with no real change
    fireEvent.change(input, { target: { value: "Anonymous" } });
    submitForm();
    expect(goLiveMock).toHaveBeenCalledWith(undefined);
  });

  it("reflects userData.dj_name when the registry resolves after mount", () => {
    // First render: registry still loading, dj_name unknown.
    userInfoMock = null;
    const { rerender } = renderWithProviders(<StartShow />);
    expect(getNamedInput("djHandle").value).toBe("");

    // Registry resolves with the user's dj_name. Re-render with the same
    // component instance — the input value should now reflect the resolved
    // dj_name, not the empty string captured at initial mount.
    userInfoMock = {
      id: "test-user-1",
      real_name: "Maura Partrick",
      dj_name: "Anonymous",
    };
    rerender(<StartShow />);
    expect(getNamedInput("djHandle").value).toBe("Anonymous");
  });

  it("stops syncing from the registry once the user types into the field", () => {
    const { rerender } = renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    // User types over the prefilled value.
    fireEvent.change(input, { target: { value: "Aubrey Hearst" } });

    // Registry refetches and lands a different dj_name. The user's typed
    // value should win — we do not clobber their in-progress edit.
    userInfoMock = {
      id: "test-user-1",
      real_name: "Maura Partrick",
      dj_name: "SomethingElse",
    };
    rerender(<StartShow />);
    expect(getNamedInput("djHandle").value).toBe("Aubrey Hearst");
  });

  it("submits no override when the registry refetches to match the user-typed value", () => {
    // Mount with one dj_name…
    userInfoMock = {
      id: "test-user-1",
      real_name: "Maura Partrick",
      dj_name: "OldName",
    };
    const { rerender } = renderWithProviders(<StartShow />);
    const input = getNamedInput("djHandle");
    // User types a different value.
    fireEvent.change(input, { target: { value: "NewName" } });

    // Registry refetches to the same value the user typed (e.g. a parallel
    // tab updated it). At submit time the comparison should see equality
    // and omit the override — not send a redundant override that captures
    // the initial-mount value.
    userInfoMock = {
      id: "test-user-1",
      real_name: "Maura Partrick",
      dj_name: "NewName",
    };
    rerender(<StartShow />);
    submitForm();
    expect(goLiveMock).toHaveBeenCalledWith(undefined);
  });
});

describe("Classic StartShow — out-of-scope fields stay disabled (#694)", () => {
  // Locked decision in #694: only the Public DJ Handle field is enabled.
  // The other hardcoded-disabled fields remain disabled until separate tickets
  // re-enable them.

  it("Real Name input remains disabled", () => {
    renderWithProviders(<StartShow />);
    expect(getNamedInput("djName").disabled).toBe(true);
  });

  it("Show Name input remains disabled", () => {
    renderWithProviders(<StartShow />);
    expect(getNamedInput("showName").disabled).toBe(true);
  });

  it("Starting Time select remains disabled", () => {
    renderWithProviders(<StartShow />);
    const select = document.querySelector(
      'select[name="startingHour"]'
    ) as HTMLSelectElement | null;
    expect(select?.disabled).toBe(true);
  });

  it("Reset button remains disabled", () => {
    renderWithProviders(<StartShow />);
    const reset = document.querySelector(
      'input[type="reset"]'
    ) as HTMLInputElement | null;
    expect(reset?.disabled).toBe(true);
  });
});
