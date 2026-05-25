import type { Rotation } from "@/lib/features/rotation/types";

export type RotationBinColorSet = {
  bg: string;
  bgSelected: string;
  bgHover: string;
  text: string;
  textSelected: string;
  border: string;
};

export const ROTATION_BINS: Rotation[] = ["H", "M", "L", "S"];

export const ROTATION_BIN_LABELS: Record<Rotation, string> = {
  H: "Heavy",
  M: "Medium",
  L: "Light",
  S: "Singles",
  N: "New",
};

export const LIGHT_ROTATION_BIN_COLORS: Record<Rotation, RotationBinColorSet> = {
  H: {
    bg: "#fce4ec",
    bgSelected: "#e53935",
    bgHover: "#f8bbd0",
    text: "#b71c1c",
    textSelected: "#fff",
    border: "#ef9a9a",
  },
  M: {
    bg: "#fff9c4",
    bgSelected: "#f9a825",
    bgHover: "#fff176",
    text: "#f57f17",
    textSelected: "#fff",
    border: "#fdd835",
  },
  L: {
    bg: "#e0f2f1",
    bgSelected: "#00897b",
    bgHover: "#b2dfdb",
    text: "#004d40",
    textSelected: "#fff",
    border: "#80cbc4",
  },
  S: {
    bg: "#e8eaf6",
    bgSelected: "#5c6bc0",
    bgHover: "#c5cae9",
    text: "#283593",
    textSelected: "#fff",
    border: "#9fa8da",
  },
  N: {
    bg: "#f3e5f5",
    bgSelected: "#8e24aa",
    bgHover: "#e1bee7",
    text: "#6a1b9a",
    textSelected: "#fff",
    border: "#ce93d8",
  },
};

export const DARK_ROTATION_BIN_COLORS: Record<Rotation, RotationBinColorSet> = {
  H: {
    bg: "#4a1a1a",
    bgSelected: "#e53935",
    bgHover: "#5c2020",
    text: "#ef9a9a",
    textSelected: "#fff",
    border: "#7f3333",
  },
  M: {
    bg: "#4a3a0a",
    bgSelected: "#f9a825",
    bgHover: "#5c4810",
    text: "#fdd835",
    textSelected: "#fff",
    border: "#7f6820",
  },
  L: {
    bg: "#1a3a36",
    bgSelected: "#00897b",
    bgHover: "#204a44",
    text: "#80cbc4",
    textSelected: "#fff",
    border: "#336a60",
  },
  S: {
    bg: "#262a4a",
    bgSelected: "#5c6bc0",
    bgHover: "#30365c",
    text: "#9fa8da",
    textSelected: "#fff",
    border: "#4a5090",
  },
  N: {
    bg: "#3a1a42",
    bgSelected: "#8e24aa",
    bgHover: "#4a2054",
    text: "#ce93d8",
    textSelected: "#fff",
    border: "#6a3080",
  },
};

export function getRotationBinColors(
  mode: "light" | "dark" | "system" | undefined,
): Record<Rotation, RotationBinColorSet> {
  return mode === "dark" ? DARK_ROTATION_BIN_COLORS : LIGHT_ROTATION_BIN_COLORS;
}
