import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

function createMockAudioRef(element?: Partial<HTMLAudioElement>) {
  return {
    current: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      ...element,
    } as unknown as HTMLAudioElement,
  };
}

function createMockAnimationFrameRef() {
  return { current: null } as React.MutableRefObject<number | null>;
}

describe("GradientAudioVisualizer", () => {
  let mockAnalyser: any;
  let mockGradient: any;
  let mockCanvasContext: any;
  let mockAudioContext: any;

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

    mockAudioContext = {
      resume: vi.fn(),
      destination: {},
    };

    // Mock requestAnimationFrame
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      expect(() =>
        render(
          <GradientAudioVisualizer
            audioRef={audioRef}
            isPlaying={false}
            audioContext={mockAudioContext}
            analyserNode={mockAnalyser}
            animationFrameRef={animationFrameRef}
          />
        )
      ).not.toThrow();
    });

    it("should render a canvas element", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      const { container } = render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });

    it("should render overlay Box component", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      expect(screen.getByTestId("overlay-box")).toBeInTheDocument();
    });
  });

  describe("canvas styling", () => {
    it("should apply gradient background to canvas", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      const { container } = render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toHaveStyle({
        background: "linear-gradient(135deg, #ff6ec4, #7873f5, #00f2fe)",
      });
    });

    it("should position canvas absolutely", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      const { container } = render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
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
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      const { container } = render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toHaveStyle({ pointerEvents: "none" });
    });
  });

  describe("overlay styling", () => {
    it("should apply overlay color when provided", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          overlayColor="white"
          animationFrameRef={animationFrameRef}
        />
      );
      expect(screen.getByTestId("overlay-box")).toHaveAttribute(
        "data-background-color",
        "white"
      );
    });

    it("should have opacity 1 when not playing", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          overlayColor="white"
          animationFrameRef={animationFrameRef}
        />
      );
      expect(screen.getByTestId("overlay-box")).toHaveAttribute(
        "data-opacity",
        "1"
      );
    });

    it("should have opacity 0.5 when playing", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={true}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          overlayColor="white"
          animationFrameRef={animationFrameRef}
        />
      );
      expect(screen.getByTestId("overlay-box")).toHaveAttribute(
        "data-opacity",
        "0.5"
      );
    });
  });

  describe("without overlayColor prop", () => {
    it("should render overlay with undefined background color", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      const overlayBox = screen.getByTestId("overlay-box");
      expect(overlayBox).toBeInTheDocument();
    });
  });

  describe("component structure", () => {
    it("should render canvas and overlay elements", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      const { container } = render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );

      expect(container.querySelector("canvas")).toBeInTheDocument();
      expect(screen.getByTestId("overlay-box")).toBeInTheDocument();
    });
  });

  describe("canvas z-index", () => {
    it("should have z-index 0 on canvas", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      const { container } = render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      const canvas = container.querySelector("canvas");
      expect(canvas).toHaveStyle({ zIndex: "0" });
    });
  });

  describe("audio context interaction", () => {
    it("should start animation when isPlaying is true", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={true}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      expect(mockAudioContext.resume).toHaveBeenCalled();
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it("should not start animation when isPlaying is false", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      render(
        <GradientAudioVisualizer
          audioRef={audioRef}
          isPlaying={false}
          audioContext={mockAudioContext}
          analyserNode={mockAnalyser}
          animationFrameRef={animationFrameRef}
        />
      );
      expect(mockAudioContext.resume).not.toHaveBeenCalled();
    });

    it("should handle null audioContext gracefully", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      expect(() =>
        render(
          <GradientAudioVisualizer
            audioRef={audioRef}
            isPlaying={false}
            audioContext={null}
            analyserNode={null}
            animationFrameRef={animationFrameRef}
          />
        )
      ).not.toThrow();
    });

    it("should handle null analyserNode gracefully", () => {
      const audioRef = createMockAudioRef();
      const animationFrameRef = createMockAnimationFrameRef();

      expect(() =>
        render(
          <GradientAudioVisualizer
            audioRef={audioRef}
            isPlaying={false}
            audioContext={mockAudioContext}
            analyserNode={null}
            animationFrameRef={animationFrameRef}
          />
        )
      ).not.toThrow();
    });
  });
});
