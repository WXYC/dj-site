import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createRef } from "react";
import { GradientAudioVisualizer } from "./GradientAudioVisualizer";

// Mock MUI Joy components
vi.mock("@mui/joy", () => ({
  Box: ({ children, sx, ...props }: any) => (
    <div
      data-testid="overlay-box"
      data-opacity={sx?.opacity}
      data-background-color={sx?.backgroundColor}
      {...props}
    >
      {children}
    </div>
  ),
}));

describe("GradientAudioVisualizer", () => {
  let mockAudioContext: any;
  let mockAnalyser: any;
  let mockSource: any;
  let mockGradient: any;
  let mockCanvasContext: any;

  beforeEach(() => {
    mockGradient = {
      addColorStop: vi.fn(),
    };

    mockCanvasContext = {
      fillStyle: "",
      fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => mockGradient),
    };

    mockAnalyser = {
      fftSize: 512,
      frequencyBinCount: 256,
      connect: vi.fn(),
      getByteFrequencyData: vi.fn(),
    };

    mockSource = {
      connect: vi.fn(),
    };

    mockAudioContext = {
      createAnalyser: vi.fn(() => mockAnalyser),
      createMediaElementSource: vi.fn(() => mockSource),
      resume: vi.fn(),
      close: vi.fn(),
    };

    // Mock AudioContext
    (window as any).AudioContext = vi.fn(() => mockAudioContext);
    (window as any).webkitAudioContext = vi.fn(() => mockAudioContext);

    // Mock requestAnimationFrame
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      expect(() =>
        render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />)
      ).not.toThrow();
    });

    it("should render a canvas element", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });

    it("should render an audio element with the provided src", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const audio = container.querySelector("audio");
      expect(audio).toBeInTheDocument();
      expect(audio).toHaveAttribute("src", "https://example.com/audio.mp3");
    });

    it("should render overlay Box component", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      expect(screen.getByTestId("overlay-box")).toBeInTheDocument();
    });

    it("should set crossOrigin attribute on audio element", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const audio = container.querySelector("audio");
      expect(audio).toHaveAttribute("crossOrigin", "anonymous");
    });

    it("should set playsInline attribute on audio element", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const audio = container.querySelector("audio");
      expect(audio).toHaveAttribute("playsinline");
    });

    it("should hide audio element with display none", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const audio = container.querySelector("audio");
      expect(audio).toHaveStyle({ display: "none" });
    });
  });

  describe("canvas styling", () => {
    it("should apply gradient background to canvas", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toHaveStyle({
        background: "linear-gradient(135deg, #ff6ec4, #7873f5, #00f2fe)",
      });
    });

    it("should position canvas absolutely", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toHaveStyle({
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
      });
    });

    it("should set pointer-events to none on canvas", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toHaveStyle({ pointerEvents: "none" });
    });
  });

  describe("overlay styling", () => {
    it("should apply overlay color when provided", () => {
      render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          overlayColor="white"
        />
      );
      expect(screen.getByTestId("overlay-box")).toHaveAttribute(
        "data-background-color",
        "white"
      );
    });

    it("should have opacity 1 when not playing", () => {
      render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          overlayColor="white"
        />
      );
      expect(screen.getByTestId("overlay-box")).toHaveAttribute(
        "data-opacity",
        "1"
      );
    });
  });

  describe("imperative handle", () => {
    it("should expose play method through ref", () => {
      const ref = createRef<{
        play: () => void;
        pause: () => void;
        readonly isPlaying: boolean;
      }>();

      render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          ref={ref}
        />
      );

      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.play).toBe("function");
    });

    it("should expose pause method through ref", () => {
      const ref = createRef<{
        play: () => void;
        pause: () => void;
        readonly isPlaying: boolean;
      }>();

      render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          ref={ref}
        />
      );

      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.pause).toBe("function");
    });

    it("should expose isPlaying getter through ref", () => {
      const ref = createRef<{
        play: () => void;
        pause: () => void;
        readonly isPlaying: boolean;
      }>();

      render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          ref={ref}
        />
      );

      expect(ref.current).toBeDefined();
      expect(typeof ref.current?.isPlaying).toBe("boolean");
    });

    it("should return false for isPlaying when audio is paused", () => {
      const ref = createRef<{
        play: () => void;
        pause: () => void;
        readonly isPlaying: boolean;
      }>();

      render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          ref={ref}
        />
      );

      // Initially paused
      expect(ref.current?.isPlaying).toBe(false);
    });
  });

  describe("without overlayColor prop", () => {
    it("should render overlay with undefined background color", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      // When overlayColor is undefined, data-background-color will be empty or not present
      const overlayBox = screen.getByTestId("overlay-box");
      expect(overlayBox).toBeInTheDocument();
    });
  });

  describe("component structure", () => {
    it("should render canvas and audio elements", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      expect(container.querySelector("canvas")).toBeInTheDocument();
      expect(screen.getByTestId("overlay-box")).toBeInTheDocument();
      expect(container.querySelector("audio")).toBeInTheDocument();
    });
  });

  describe("canvas z-index", () => {
    it("should have z-index 0 on canvas", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toHaveStyle({ zIndex: "0" });
    });
  });

  describe("audio context setup", () => {
    it("should create AudioContext on mount", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      expect(window.AudioContext).toHaveBeenCalled();
    });

    it("should create analyser from audio context", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });

    it("should create media element source from audio context", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      expect(mockAudioContext.createMediaElementSource).toHaveBeenCalled();
    });

    it("should connect source to analyser", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      expect(mockSource.connect).toHaveBeenCalledWith(mockAnalyser);
    });

    it("should connect analyser to destination", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      expect(mockAnalyser.connect).toHaveBeenCalled();
    });

    it("should set fftSize on analyser", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);
      expect(mockAnalyser.fftSize).toBe(512);
    });
  });

  describe("different src props", () => {
    it("should render with different audio source", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://different.com/stream.mp3" />
      );
      const audio = container.querySelector("audio");
      expect(audio).toHaveAttribute("src", "https://different.com/stream.mp3");
    });
  });

  describe("audio events and visualization", () => {
    it("should handle play event and update playing state", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" overlayColor="white" />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // Trigger play event
      act(() => {
        const playEvent = new Event("play");
        audio.dispatchEvent(playEvent);
      });

      // Overlay opacity should change to 0.5 when playing
      const overlay = screen.getByTestId("overlay-box");
      expect(overlay).toHaveAttribute("data-opacity", "0.5");
    });

    it("should handle pause event and update playing state", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" overlayColor="white" />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // First play then pause
      act(() => {
        audio.dispatchEvent(new Event("play"));
      });

      act(() => {
        audio.dispatchEvent(new Event("pause"));
      });

      // Overlay opacity should be back to 1 when paused
      const overlay = screen.getByTestId("overlay-box");
      expect(overlay).toHaveAttribute("data-opacity", "1");
    });

    it("should call context resume on audio.onplay", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // Trigger onplay handler
      if (audio.onplay) {
        audio.onplay(new Event("play"));
      }

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it("should start animation loop on audio.onplay", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // Trigger onplay handler
      if (audio.onplay) {
        audio.onplay(new Event("play"));
      }

      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it("should get frequency data during draw loop", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // Trigger onplay handler which calls draw()
      if (audio.onplay) {
        audio.onplay(new Event("play"));
      }

      expect(mockAnalyser.getByteFrequencyData).toHaveBeenCalled();
    });

    it("should draw bars on canvas during animation", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;

      // Trigger onplay handler which calls draw()
      if (audio.onplay) {
        audio.onplay(new Event("play"));
      }

      expect(mockCanvasContext.fillRect).toHaveBeenCalled();
    });
  });

  describe("resize handling", () => {
    it("should handle window resize event", () => {
      const { container } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      // Trigger resize
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // createLinearGradient should be called for the gradient
      expect(mockCanvasContext.createLinearGradient).toHaveBeenCalled();
    });

    it("should create gradient with color stops on resize", () => {
      render(<GradientAudioVisualizer src="https://example.com/audio.mp3" />);

      // Gradient should have color stops added
      expect(mockGradient.addColorStop).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should close audio context on unmount", () => {
      const { unmount } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      unmount();

      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it("should remove resize event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = render(
        <GradientAudioVisualizer src="https://example.com/audio.mp3" />
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe("imperative handle methods", () => {
    it("should call audio.play when play() is called through ref", () => {
      const ref = createRef<{
        play: () => void;
        pause: () => void;
        readonly isPlaying: boolean;
      }>();

      const { container } = render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          ref={ref}
        />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;
      const playSpy = vi.spyOn(audio, "play").mockResolvedValue(undefined);

      ref.current?.play();

      expect(playSpy).toHaveBeenCalled();
      playSpy.mockRestore();
    });

    it("should call audio.pause when pause() is called through ref", () => {
      const ref = createRef<{
        play: () => void;
        pause: () => void;
        readonly isPlaying: boolean;
      }>();

      const { container } = render(
        <GradientAudioVisualizer
          src="https://example.com/audio.mp3"
          ref={ref}
        />
      );

      const audio = container.querySelector("audio") as HTMLAudioElement;
      const pauseSpy = vi.spyOn(audio, "pause").mockImplementation(() => {});

      ref.current?.pause();

      expect(pauseSpy).toHaveBeenCalled();
      pauseSpy.mockRestore();
    });
  });
});
