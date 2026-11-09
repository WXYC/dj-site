import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { ComponentType } from "react";
import BreakpointButton from "@/src/components/experiences/modern/flowsheet/Search/BreakpointButton";
import TalksetButton from "@/src/components/experiences/modern/flowsheet/Search/TalksetButton";
import WhosOnButton from "@/src/components/experiences/modern/flowsheet/Search/WhosOnButton";
import { renderWithProviders } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({ live: true }),
  useCurrentBreakpointHours: () => [],
}));

vi.mock("@/src/hooks/whosOnHooks", () => ({
  useWhosOn: () => ({
    available: true,
    defaultRole: "guest",
    isLoading: false,
    refusal: null,
    clearRefusal: vi.fn(),
    add: vi.fn(),
  }),
}));

// A modal sits at Joy's modal layer (1300); a button stacked higher shows
// through every dialog opened over the flowsheet.
describe("flowsheet action buttons", () => {
  it.each([
    ["breakpoint", BreakpointButton],
    ["talkset", TalksetButton],
    ["who's on", WhosOnButton],
  ] as [string, ComponentType][])("the %s button is not stacked above dialogs", (_name, Button) => {
    renderWithProviders(<Button />);
    const zIndex = getComputedStyle(screen.getByRole("button")).zIndex;
    expect(zIndex === "" || zIndex === "auto" || Number(zIndex) < 1300).toBe(true);
  });
});
