import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

// Mock useShowControl().goLive — we only care that StartShow forwards the
// trimmed Public DJ Handle as the second arg (the override) when the user
// edits it, and omits it when unchanged.
const goLiveMock = vi.fn(() => Promise.resolve({ status: "ok" as const }));
let userInfoMock: { id: string; real_name?: string; dj_name?: string } | null = {
  id: "test-user-1",
  real_name: "Maura Partrick",
  dj_name: "Anonymous",
};
// Nothing else on air by default, so the ordinary submit reaches goLive
// directly; the handoff cases below set an open show.
let openShowMock: {
  showId: number;
  djNames: readonly string[];
  lastLoggedAt: string | null;
} | null = null;

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ goLive: goLiveMock }),
  // Returns a reader: the real hook is read in the click handler, not rendered.
  useOpenShowHandoff: () => () => openShowMock,
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useRegistry: () => ({ info: userInfoMock, loading: false }),
}));

vi.mock("@/src/utils/helpScreen", () => ({
  OpenHelp: vi.fn(),
}));

import StartShow from "@/src/components/experiences/classic/flowsheet/StartShow";

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
  goLiveMock.mockResolvedValue({ status: "ok" as const });
  openShowMock = null;
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

describe("Classic StartShow — the handoff prompt", () => {
  const OPEN_SHOW = {
    showId: 1951224,
    djNames: ["dj sue"],
    lastLoggedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  };

  const signOn = async () => {
    renderWithProviders(<StartShow />);
    submitForm();
    await screen.findByTestId("go-live-handoff-prompt");
  };

  it("names who is on air and how long ago they logged, instead of sending a blind join", async () => {
    openShowMock = OPEN_SHOW;
    await signOn();

    expect(screen.getByText(/dj sue is on air\. Last logged 5h 0m ago\./)).toBeInTheDocument();
    // The whole point of asking first: nothing was sent, so cancelling costs
    // the DJ nothing and the outgoing DJ's show is untouched.
    expect(goLiveMock).not.toHaveBeenCalled();
  });

  it("sends a co-host join when the DJ picks Join Existing Show", async () => {
    openShowMock = OPEN_SHOW;
    await signOn();
    fireEvent.click(screen.getByTestId("go-live-handoff-join"));

    expect(goLiveMock).toHaveBeenCalledWith(undefined, {
      intent: "join",
      expected_show_id: undefined,
    });
  });

  it("binds End Existing Show to the show the DJ was actually shown", async () => {
    openShowMock = OPEN_SHOW;
    await signOn();
    fireEvent.click(screen.getByTestId("go-live-handoff-takeover"));

    expect(goLiveMock).toHaveBeenCalledWith(undefined, {
      intent: "takeover",
      expected_show_id: 1951224,
    });
  });

  it("sends nothing at all on Cancel", async () => {
    openShowMock = OPEN_SHOW;
    await signOn();
    fireEvent.click(screen.getByTestId("go-live-handoff-cancel"));

    expect(goLiveMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("go-live-handoff-prompt")).toBeNull();
  });

  // The handle typed into this form is the surface's whole reason for
  // existing; re-deriving it after the prompt would silently drop it.
  it("replays the typed Public DJ Handle through the prompt", async () => {
    openShowMock = OPEN_SHOW;
    renderWithProviders(<StartShow />);
    fireEvent.change(getNamedInput("djHandle"), {
      target: { value: "eureka!" },
    });
    submitForm();
    await screen.findByTestId("go-live-handoff-prompt");
    fireEvent.click(screen.getByTestId("go-live-handoff-takeover"));

    expect(goLiveMock).toHaveBeenCalledWith("eureka!", {
      intent: "takeover",
      expected_show_id: 1951224,
    });
  });

  it("does not prompt when nothing is on air", async () => {
    openShowMock = null;
    renderWithProviders(<StartShow />);
    submitForm();

    expect(screen.queryByTestId("go-live-handoff-prompt")).toBeNull();
    expect(goLiveMock).toHaveBeenCalledWith(undefined);
  });
});
