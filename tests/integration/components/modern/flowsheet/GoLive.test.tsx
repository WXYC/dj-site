import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import GoLive from "@/src/components/experiences/modern/flowsheet/GoLive";

// Mock flowsheet hooks
const mockGoLive = vi.fn();
const mockLeave = vi.fn();
const mockSetAutoPlay = vi.fn();
const mockUseFlowsheetSaving = vi.fn(() => false);

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
  useFlowsheetSaving: () => mockUseFlowsheetSaving(),
}));

describe("GoLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("guards the on-air dot's aspect ratio against flex distortion", () => {
    render(<GoLive />);
    const dot = screen.getByTestId("flowsheet-on-air-dot");
    expect(dot).toHaveStyle({ flexShrink: "0", aspectRatio: "1" });
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
