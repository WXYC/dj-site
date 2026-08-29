import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import GoLive from "@/src/components/experiences/modern/flowsheet/GoLive";

// Mock flowsheet hooks
const mockGoLive = vi.fn(() => Promise.resolve({ status: "ok" as const }));
const mockLeave = vi.fn();
const mockSetAutoPlay = vi.fn();
const mockUseFlowsheetSaving = vi.fn(() => false);
// Nothing on air but this DJ, so the toggle reaches goLive directly. The
// handoff cases below install an open show.
const mockUseOpenShowHandoff = vi.fn<
  () => { showId: number; djNames: string; lastLoggedAt: string | null } | null
>(() => null);

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: vi.fn(() => ({
    live: false,
    autoplay: false,
    setAutoPlay: mockSetAutoPlay,
    loading: false,
    currentShow: -1,
    goLive: mockGoLive,
    leave: mockLeave,
  })),
  useOpenShowHandoff: () => mockUseOpenShowHandoff(),
  useFlowsheetSaving: () => mockUseFlowsheetSaving(),
}));

describe("GoLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoLive.mockResolvedValue({ status: "ok" as const });
    mockUseOpenShowHandoff.mockReturnValue(null);
  });

  it("should render when not live", () => {
    render(<GoLive />);
    expect(screen.getByText(/You Are Off Air/)).toBeInTheDocument();
  });

  it("should show 'You Are On Air' when live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: 1,
    });

    render(<GoLive />);
    expect(screen.getByText(/You Are On Air/)).toBeInTheDocument();
  });

  it("should call goLive when clicking go live button while not live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: false,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: -1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    // The WiFi icon button (index 1)
    const goLiveButton = buttons[1];
    fireEvent.click(goLiveButton);

    expect(mockGoLive).toHaveBeenCalled();
  });

  it("should call leave when clicking leave button while live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: 1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    const leaveButton = buttons[1];
    fireEvent.click(leaveButton);

    expect(mockLeave).toHaveBeenCalled();
  });

  it("should toggle autoplay when clicking autoplay button", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: 1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    const autoplayButton = buttons[0];
    fireEvent.click(autoplayButton);

    expect(mockSetAutoPlay).toHaveBeenCalledWith(true);
  });

  it("should disable autoplay button when not live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: false,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: -1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    const autoplayButton = buttons[0];
    expect(autoplayButton).toBeDisabled();
  });

  it("should show loading state", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: false,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: true,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: -1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    // Go live button should be disabled when loading
    expect(buttons[1]).toBeDisabled();
  });

  describe("hydration safety", () => {
    it("keeps the go-live aria-label consistent between the server render and the client's first hydration pass, then updates once mounted", async () => {
      const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
      // clearAllMocks() clears call history, not a prior mockReturnValue.
      vi.mocked(useShowControl).mockReturnValue({
        live: false,
        autoplay: false,
        setAutoPlay: mockSetAutoPlay,
        loading: false,
        goLive: mockGoLive,
        leave: mockLeave,
        currentShow: -1,
      });
      vi.mocked(useShowControl).mockImplementationOnce(() => ({
        live: false,
        autoplay: false,
        setAutoPlay: mockSetAutoPlay,
        loading: true,
        goLive: mockGoLive,
        leave: mockLeave,
        currentShow: -1,
      }));

      const serverHtml = renderToString(<GoLive />);
      expect(serverHtml).toContain('aria-label="Loading..."');
      // Joy renders `disabled` as a `Mui-disabled` class, not a native
      // `disabled` attribute, so that's what a divergent `loading` prop
      // would show up as in the server markup.
      expect(serverHtml).toMatch(
        /data-testid="flowsheet-go-live-button"[^>]*class="[^"]*\bMui-disabled\b/
      );

      const container = document.createElement("div");
      container.innerHTML = serverHtml;
      document.body.appendChild(container);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      let root!: ReturnType<typeof hydrateRoot>;
      act(() => {
        root = hydrateRoot(container, <GoLive />);
      });

      // React's mismatch dump includes unchanged attributes as surrounding
      // context, so match a `+`/`-` diff line, not any mention of the name.
      const ariaLabelMismatchLogged = errorSpy.mock.calls.some((call) =>
        call.some(
          (arg) => typeof arg === "string" && /^[+-]\s*aria-label=/m.test(arg)
        )
      );
      expect(ariaLabelMismatchLogged).toBe(false);
      // disabled/loading render as class="…Mui-disabled…" / "…Mui-loading…",
      // so a diverging `loading` prop shows up as a `className` diff line.
      const classNameMismatchLogged = errorSpy.mock.calls.some((call) =>
        call.some(
          (arg) => typeof arg === "string" && /^[+-]\s*className=/m.test(arg)
        )
      );
      expect(classNameMismatchLogged).toBe(false);
      errorSpy.mockRestore();

      const goLiveButton = container.querySelector(
        '[data-testid="flowsheet-go-live-button"]'
      );
      const buttonGroup = container.querySelector('[role="group"]');
      await waitFor(() => {
        expect(buttonGroup).toHaveAttribute("aria-label", "Click to go live");
        expect(goLiveButton?.className).not.toMatch(/\bMui-disabled\b/);
      });

      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    });
  });

  it("guards the on-air dot against being shrunk by a flex parent", () => {
    render(<GoLive />);
    // The dot has no identifying attribute of its own (a test hook would
    // define product markup); it's the last child of the status button,
    // after the "You Are On/Off Air" text node.
    const statusButton = screen.getByTestId("flowsheet-live-status");
    const dot = statusButton.lastElementChild;
    expect(dot).not.toBeNull();
    expect(dot).toHaveStyle({ flexShrink: "0" });
  });

  describe("the handoff prompt", () => {
    const OPEN_SHOW = {
      showId: 1951224,
      djNames: "dj sue",
      lastLoggedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    };

    const openPrompt = async (control: HTMLElement) => {
      fireEvent.click(control);
      return screen.findByTestId("go-live-handoff-dialog");
    };

    const goLiveControls = () => ({
      icon: screen.getByTestId("flowsheet-go-live-button"),
      status: screen.getByTestId("flowsheet-live-status"),
    });

    // Both controls, because the icon button carried its own copy of the
    // toggle: leaving it unrouted would make it a silent bypass of the whole
    // decision.
    it.each(["icon", "status"] as const)(
      "prompts instead of joining blindly when pressed via the %s control",
      async (control) => {
        mockUseOpenShowHandoff.mockReturnValue(OPEN_SHOW);
        render(<GoLive />);

        await openPrompt(goLiveControls()[control]);

        expect(
          screen.getByText(/dj sue is on air\. Last logged 5h 0m ago\./)
        ).toBeInTheDocument();
        expect(mockGoLive).not.toHaveBeenCalled();
      }
    );

    it("sends a co-host join from Join Existing Show", async () => {
      mockUseOpenShowHandoff.mockReturnValue(OPEN_SHOW);
      render(<GoLive />);
      await openPrompt(goLiveControls().icon);

      fireEvent.click(screen.getByTestId("go-live-handoff-join"));

      expect(mockGoLive).toHaveBeenCalledWith(undefined, {
        intent: "join",
        expected_show_id: undefined,
      });
    });

    it("binds End Existing Show to the show the DJ was shown", async () => {
      mockUseOpenShowHandoff.mockReturnValue(OPEN_SHOW);
      render(<GoLive />);
      await openPrompt(goLiveControls().icon);

      fireEvent.click(screen.getByTestId("go-live-handoff-takeover"));

      expect(mockGoLive).toHaveBeenCalledWith(undefined, {
        intent: "takeover",
        expected_show_id: 1951224,
      });
    });

    it("sends nothing at all on Cancel", async () => {
      mockUseOpenShowHandoff.mockReturnValue(OPEN_SHOW);
      render(<GoLive />);
      await openPrompt(goLiveControls().icon);

      fireEvent.click(screen.getByTestId("go-live-handoff-cancel"));

      await waitFor(() =>
        expect(screen.queryByTestId("go-live-handoff-dialog")).toBeNull()
      );
      expect(mockGoLive).not.toHaveBeenCalled();
    });

    // A DJ re-pressing their own toggle, or arriving at an empty slot, must
    // stay one click. A dialog that fires every shift gets dismissed reflexively.
    it("stays a single click when nobody else is on air", async () => {
      mockUseOpenShowHandoff.mockReturnValue(null);
      render(<GoLive />);

      fireEvent.click(goLiveControls().icon);

      expect(mockGoLive).toHaveBeenCalledWith(undefined);
      expect(screen.queryByTestId("go-live-handoff-dialog")).toBeNull();
    });

    // The server is the backstop for the window where the client's poll and
    // the truth disagree.
    it("opens the prompt on the server's own refusal", async () => {
      mockUseOpenShowHandoff.mockReturnValue(null);
      mockGoLive.mockResolvedValue({
        status: "conflict",
        handoff: { showId: 1951224, djNames: "dj sue", lastLoggedAt: null },
        payload: { dj_id: "u1" },
      } as never);
      render(<GoLive />);

      fireEvent.click(goLiveControls().icon);

      await screen.findByTestId("go-live-handoff-dialog");
      expect(screen.getByText(/dj sue is on air\./)).toBeInTheDocument();
    });
  });

  it("should show saving indicator when isSaving", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: 1,
    });
    // Not `mockReturnValueOnce`: GoLive re-renders once more after mount,
    // calling this hook again — a "once" value wouldn't cover that render.
    mockUseFlowsheetSaving.mockReturnValue(true);

    render(<GoLive />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
