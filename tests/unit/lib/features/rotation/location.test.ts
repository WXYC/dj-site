import { describe, it, expect } from "vitest";

import { rotationLocationFor } from "@/lib/features/rotation/location";
import { RotationBin } from "@/lib/features/rotation/types";

describe("rotationLocationFor", () => {
  it("returns null for a non-rotating row", () => {
    expect(rotationLocationFor(undefined, undefined)).toBeNull();
  });

  it("shows bin + card and a tooltip with no name when the card is unnamed", () => {
    const location = rotationLocationFor(RotationBin.H, {
      id: 1,
      bin: RotationBin.H,
      number: 2,
    });

    expect(location).toEqual({
      label: "H · card 2",
      title: "Heavy rotation, card 2",
    });
  });

  it("carries the card's name in the tooltip when set", () => {
    const location = rotationLocationFor(RotationBin.M, {
      id: 4,
      bin: RotationBin.M,
      number: 1,
      name: "Fresh Arrivals",
    });

    expect(location).toEqual({
      label: "M · card 1",
      title: 'Medium rotation, card 1 "Fresh Arrivals"',
    });
  });

  it("degrades to bin-only when the card is absent (older Backend or a stale cache row)", () => {
    expect(rotationLocationFor(RotationBin.S, undefined)).toEqual({
      label: "S",
      title: "Singles rotation",
    });
  });

  it("degrades to bin-only when the card is the explicit not-on-a-card null", () => {
    expect(rotationLocationFor(RotationBin.L, null)).toEqual({
      label: "L",
      title: "Light rotation",
    });
  });
});
