import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import NowPlaying from "@/src/widgets/NowPlaying";

const mockUseWhoIsLiveQuery = vi.fn();
const mockUseGetNowPlayingQuery = vi.fn();

vi.mock("@/lib/features/flowsheet/api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/features/flowsheet/api")
  >();
  return {
    ...actual,
    useGetNowPlayingQuery: (arg: unknown, options: unknown) =>
      mockUseGetNowPlayingQuery(arg, options),
    useWhoIsLiveQuery: () => mockUseWhoIsLiveQuery(),
  };
});

// Expose the toggle handler and playing flag through a real button so the tests
// exercise the widget the way the UI does.
vi.mock("@/src/widgets/NowPlaying/Main", () => ({
  default: ({
    isPlaying,
    onTogglePlay,
  }: {
    isPlaying: boolean;
    onTogglePlay: () => void;
  }) => (
    <button
      data-testid="toggle"
      data-is-playing={isPlaying}
      onClick={onTogglePlay}
    />
  ),
}));

vi.mock("@/src/widgets/NowPlaying/Mini", () => ({
  default: () => <div data-testid="now-playing-mini" />,
}));

function installFakeAudio() {
  class FakeAudioContext {
    destination = {};
    createAnalyser = vi.fn(() => ({ fftSize: 0, connect: vi.fn() }));
    createMediaElementSource = vi.fn(() => ({ connect: vi.fn() }));
    resume = vi.fn();
    close = vi.fn(() => Promise.resolve());
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
}

describe("NowPlaying stream playback", () => {
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;
  let loadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    installFakeAudio();

    mockUseWhoIsLiveQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    mockUseGetNowPlayingQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    // jsdom leaves the media methods unimplemented; back them with stubs that
    // emit the real play/pause events the widget listens for.
    playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event("play"));
        return Promise.resolve();
      });
    pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event("pause"));
      });
    loadSpy = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    playSpy.mockRestore();
    pauseSpy.mockRestore();
    loadSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  function getToggle() {
    return screen.getByTestId("toggle");
  }

  function getAudio(container: HTMLElement) {
    return container.querySelector("audio#now-playing-music") as HTMLAudioElement;
  }

  it("starts the stream and reflects the playing state on first toggle", () => {
    const { container } = render(<NowPlaying mini={false} />);
    const audio = getAudio(container);

    fireEvent.click(getToggle());

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(audio.getAttribute("src")).toBe("https://audio-mp3.ibiblio.org/wxyc.mp3");
    expect(getToggle()).toHaveAttribute("data-is-playing", "true");
  });

  it("pauses without tearing down the element on second toggle", () => {
    const { container } = render(<NowPlaying mini={false} />);
    const audio = getAudio(container);

    fireEvent.click(getToggle());
    fireEvent.click(getToggle());

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    // The src must survive a pause so resume can play again; load() would empty
    // the element and desync the button.
    expect(audio.hasAttribute("src")).toBe(true);
    expect(loadSpy).not.toHaveBeenCalled();
    expect(getToggle()).toHaveAttribute("data-is-playing", "false");
  });

  it("resumes playback on a third toggle", () => {
    render(<NowPlaying mini={false} />);

    fireEvent.click(getToggle());
    fireEvent.click(getToggle());
    fireEvent.click(getToggle());

    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(getToggle()).toHaveAttribute("data-is-playing", "true");
  });

  it("clears the playing state when the element is emptied outside the toggle path", () => {
    const { container } = render(<NowPlaying mini={false} />);
    const audio = getAudio(container);

    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute("data-is-playing", "true");

    act(() => {
      audio.dispatchEvent(new Event("emptied"));
    });

    expect(getToggle()).toHaveAttribute("data-is-playing", "false");
  });
});
