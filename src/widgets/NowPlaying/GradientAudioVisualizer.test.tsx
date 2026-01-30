import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GradientAudioVisualizer } from "./GradientAudioVisualizer";
import React, { createRef } from "react";

// Mock HTMLMediaElement methods
beforeEach(() => {
  // Mock play and pause methods
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();

  // Mock canvas context
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillStyle: "",
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  }));

  // Mock AudioContext
  vi.stubGlobal("AudioContext", vi.fn(() => ({
    createAnalyser: () => ({
      fftSize: 512,
      frequencyBinCount: 256,
      connect: vi.fn(),
      getByteFrequencyData: vi.fn(),
    }),
    createMediaElementSource: () => ({
      connect: vi.fn(),
    }),
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
  })));
});

describe("GradientAudioVisualizer", () => {
  it("should render canvas element", () => {
    render(<GradientAudioVisualizer src="https://test.com/audio.mp3" />);

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should render audio element", () => {
    render(<GradientAudioVisualizer src="https://test.com/audio.mp3" />);

    const audio = document.querySelector("audio");
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute("src", "https://test.com/audio.mp3");
  });

  it("should have crossOrigin anonymous attribute", () => {
    render(<GradientAudioVisualizer src="https://test.com/audio.mp3" />);

    const audio = document.querySelector("audio");
    expect(audio).toHaveAttribute("crossOrigin", "anonymous");
  });

  it("should expose play function via ref", () => {
    const ref = createRef<{ play: () => void; pause: () => void; isPlaying: boolean }>();
    render(
      <GradientAudioVisualizer src="https://test.com/audio.mp3" ref={ref} />
    );

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.play).toBe("function");
  });

  it("should expose pause function via ref", () => {
    const ref = createRef<{ play: () => void; pause: () => void; isPlaying: boolean }>();
    render(
      <GradientAudioVisualizer src="https://test.com/audio.mp3" ref={ref} />
    );

    expect(typeof ref.current?.pause).toBe("function");
  });

  it("should expose isPlaying getter via ref", () => {
    const ref = createRef<{ play: () => void; pause: () => void; isPlaying: boolean }>();
    render(
      <GradientAudioVisualizer src="https://test.com/audio.mp3" ref={ref} />
    );

    expect(ref.current?.isPlaying).toBe(false);
  });

  it("should call play on audio element when play is called via ref", () => {
    const ref = createRef<{ play: () => void; pause: () => void; isPlaying: boolean }>();
    render(
      <GradientAudioVisualizer src="https://test.com/audio.mp3" ref={ref} />
    );

    ref.current?.play();

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("should call pause on audio element when pause is called via ref", () => {
    const ref = createRef<{ play: () => void; pause: () => void; isPlaying: boolean }>();
    render(
      <GradientAudioVisualizer src="https://test.com/audio.mp3" ref={ref} />
    );

    ref.current?.pause();

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("should render with overlay color", () => {
    render(
      <GradientAudioVisualizer
        src="https://test.com/audio.mp3"
        overlayColor="white"
      />
    );

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("should have hidden audio element style", () => {
    render(<GradientAudioVisualizer src="https://test.com/audio.mp3" />);

    const audio = document.querySelector("audio");
    expect(audio).toHaveStyle({ display: "none" });
  });
});
