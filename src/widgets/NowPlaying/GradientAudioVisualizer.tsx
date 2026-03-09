import { MutableRefObject, RefObject, useEffect, useRef } from "react";

import { Box } from "@mui/joy";

export type GradientAudioVisualizerProps = {
  audioRef: RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  overlayColor?: string;
  animationFrameRef: MutableRefObject<number | null>;
};

export function GradientAudioVisualizer({
  audioRef,
  isPlaying,
  audioContext,
  analyserNode,
  overlayColor,
  animationFrameRef,
}: GradientAudioVisualizerProps) {
  //#region Visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !analyserNode || !audioContext) return;

    const c = canvas.getContext("2d")!;
    const buffer = new Uint8Array(analyserNode.frequencyBinCount);

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      grad = c.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "rgba(255, 110, 199, 1)");
      grad.addColorStop(0.25, "rgba(79, 172, 254, 1)");
      grad.addColorStop(0.5, "rgba(0, 242, 254, 1)");
      grad.addColorStop(0.75, "rgba(79, 172, 254, 1)");
      grad.addColorStop(1, "rgba(255, 110, 199, 1)");
    };
    let grad: CanvasGradient;
    resize();
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      if (!analyserNode) {
        animationFrameRef.current = null;
        return;
      }

      analyserNode.getByteFrequencyData(buffer);

      c.fillStyle = "rgba(255, 110, 199,0.08)"; // motion-blur trail
      c.fillRect(0, 0, canvas.width, canvas.height);

      const barW = (canvas.width / buffer.length) * 2.5;
      let x = 0;
      buffer.forEach((v) => {
        const h = v * 0.7; // amplitude → bar height
        c.fillStyle = grad;
        c.fillRect(x, canvas.height - h, Math.ceil(barW), h);
        x += barW + 1;
      });

      // Schedule next frame
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    const handlePlay = () => {
      audioContext.resume();
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    audio.addEventListener("play", handlePlay);

    // Start drawing if already playing
    if (isPlaying) {
      audioContext.resume();
      animationFrameRef.current = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", resize);
      audio.removeEventListener("play", handlePlay);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [audioRef, analyserNode, audioContext, isPlaying, animationFrameRef]);
  //#endregion

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          background: "linear-gradient(135deg, #ff6ec4, #7873f5, #00f2fe)",
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          backgroundColor: overlayColor,
          opacity: isPlaying ? 0.5 : 1,
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
          backdropFilter: "blur(2px)",
          transition: "background-color 2s ease, opacity 2s ease",
        }}
      ></Box>
    </>
  );
}
