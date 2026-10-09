import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";

vi.mock("@/src/hooks/authenticationHooks", () => ({ useAuthentication: vi.fn() }));

import ReviewGateRefusal from "@/src/components/shared/ReviewGateRefusal";

const signedIn = (authority: Authorization) => ({ data: { user: { id: "u1", authority } } });

describe("ReviewGateRefusal", () => {
  beforeEach(() => {
    vi.mocked(useAuthentication).mockReset();
  });

  it("says where new releases go, with the station's wording", () => {
    vi.mocked(useAuthentication).mockReturnValue(signedIn(Authorization.DJ) as never);
    renderWithProviders(<ReviewGateRefusal />);

    expect(
      screen.getByText(
        "New releases go onto the review shelf first, and are filed from there once a review is chosen.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["a music director", signedIn(Authorization.MD), true],
    ["a station manager", signedIn(Authorization.SM), true],
    ["a DJ", signedIn(Authorization.DJ), false],
    ["no session", { data: { message: "Not Authenticated" } }, false],
  ])("offers the review shelf link to %s: %s", (_who, auth, linked) => {
    vi.mocked(useAuthentication).mockReturnValue(auth as never);
    renderWithProviders(<ReviewGateRefusal />);

    const link = screen.queryByRole("link", { name: "Open the review shelf" });
    if (linked) expect(link).toHaveAttribute("href", "/dashboard/admin/intake");
    else expect(link).not.toBeInTheDocument();
  });
});
