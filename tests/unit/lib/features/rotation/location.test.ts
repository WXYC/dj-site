import { describe, it, expect } from "vitest";

import { rotationLocationFor } from "@/lib/features/rotation/location";
import { RotationBin } from "@/lib/features/rotation/types";

describe("rotationLocationFor", () => {
  it("returns null for a non-rotating row", () => {
    expect(rotationLocationFor(undefined, undefined)).toBeNull();
  });

  it("exposes bin + card number, with a tooltip carrying no name when the card is unnamed", () => {
    const location = rotationLocationFor(RotationBin.H, {
      id: 1,
      bin: RotationBin.H,
      number: 2,
    });

    expect(location).toEqual({
      bin: RotationBin.H,
      cardNumber: 2,
      cardName: null,
      title: "Heavy rotation, card 2",
    });
  });

  it("exposes a card number past 20, so the badge is never bounded to the circled-digit glyphs", () => {
    const location = rotationLocationFor(RotationBin.H, {
      id: 9,
      bin: RotationBin.H,
      number: 42,
    });

    expect(location).toEqual({
      bin: RotationBin.H,
      cardNumber: 42,
      cardName: null,
      title: "Heavy rotation, card 42",
    });
  });

  it("carries the card's name discretely and in the tooltip when set", () => {
    const location = rotationLocationFor(RotationBin.M, {
      id: 4,
      bin: RotationBin.M,
      number: 1,
      name: "Fresh Arrivals",
    });

    // Curly quotes, not ASCII straight quotes: the tooltip copy is specified
    // character-for-character by the visual spec.
    expect(location).toEqual({
      bin: RotationBin.M,
      cardNumber: 1,
      cardName: "Fresh Arrivals",
      title: "Medium rotation, card 1 “Fresh Arrivals”",
    });
  });

  it("degrades to bin-only when the card is absent (older Backend or a stale cache row)", () => {
    expect(rotationLocationFor(RotationBin.S, undefined)).toEqual({
      bin: RotationBin.S,
      cardNumber: null,
      cardName: null,
      title: "Singles rotation",
    });
  });

  it("degrades to bin-only when the card is the explicit not-on-a-card null", () => {
    expect(rotationLocationFor(RotationBin.L, null)).toEqual({
      bin: RotationBin.L,
      cardNumber: null,
      cardName: null,
      title: "Light rotation",
    });
  });
});
