import { describe, it, expect, vi } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import RotationThresholdsRedirect from "@/app/dashboard/@modern/admin/rotation/thresholds/page";

// Access is the rotation layout's and the shelf page's to enforce: this route
// only forwards a saved link to where the screen now lives.
describe("rotation thresholds route", () => {
  it("forwards to the replacement windows dialog on the rotation shelf", () => {
    expect(() => RotationThresholdsRedirect()).toThrow("NEXT_REDIRECT:/dashboard/admin/rotation?windows=1");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/admin/rotation?windows=1");
  });
});
