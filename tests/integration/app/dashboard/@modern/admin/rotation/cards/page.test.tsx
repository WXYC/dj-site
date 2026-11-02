import { describe, it, expect, vi } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import RotationCardsRedirect from "@/app/dashboard/@modern/admin/rotation/cards/page";

// Access is the rotation layout's and the shelf page's to enforce: this route
// only forwards a saved link to where the screen now lives.
describe("rotation cards route", () => {
  it("forwards to the By-card view on the rotation shelf", () => {
    expect(() => RotationCardsRedirect()).toThrow("NEXT_REDIRECT:/dashboard/admin/rotation?view=cards");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/admin/rotation?view=cards");
  });
});
