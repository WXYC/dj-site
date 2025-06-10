import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Box } from "@mui/joy";

export const GradientAudioVisualizer = forwardRef(
  function GradientAudioVisualizer({ src, overlayColor }: { src: string; overlayColor?: string; }, ref) {
    //#region Audio Player
    const audioRef = useRef<HTMLAudioElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          audioRef?.current?.play();
        },
        pause: () => {
          audioRef?.current?.pause();
        },
        get isPlaying() {
          return !!audioRef.current && !audioRef.current.paused;
        },
      }),
      []
    );
    //#endregion

    const [playing, setPlaying] = useState(false);

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const handlePlay = () => setPlaying(true);
      const handlePause = () => setPlaying(false);
      audio.addEventListener("play", handlePlay);
      audio.addEventListener("pause", handlePause);
      return () => {
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("pause", handlePause);
      };
    }, [audioRef]);

    //#region Visualizer
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const audio = audioRef.current;
      const canvas = canvasRef.current;
      if (!audio || !canvas) return;

      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const c = canvas.getContext("2d")!;
      const buffer = new Uint8Array(analyser.frequencyBinCount);

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
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(buffer);

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
      };

      audio.onplay = () => {
        ctx.resume();
        draw();
      };

      return () => {
        window.removeEventListener("resize", resize);
        ctx.close();
      };
    }, []);
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
            backgroundColor: playing ? (overlayColor ?? "transparent") : "neutral.800",
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
            backdropFilter: "blur(2px)",
            transition: "background-color 2s ease",
          }}
        ></Box>
        <audio
          ref={audioRef}
          src={src}
          crossOrigin="anonymous"
          playsInline
          style={{ display: "none" }}
        />
      </>
    );
  }
);
