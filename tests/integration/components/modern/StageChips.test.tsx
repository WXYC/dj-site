import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import StageChips from "@/src/components/experiences/modern/StageChips";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router, { pathname: "/dashboard/reviews/mine", search: () => url.search });
});

const STAGES = [
  { id: "open", label: "Open reviews", count: 2 },
  { id: "submitted", label: "Submitted", count: 0 },
  { id: "cover", label: "On the cover", count: 5 },
] as const;

const renderChips = () =>
  renderWithProviders(
    <StageChips label="Which reviews to show" stages={STAGES} fallback="open">
      {(stage) => <p>{`showing ${stage}`}</p>}
    </StageChips>,
  );

beforeEach(() => {
  router.replace.mockClear();
  url.search = "";
});

describe("StageChips", () => {
  it("is a named tablist of tabs, one selected, with a tabpanel named by the selected chip", () => {
    renderChips();

    const tablist = screen.getByRole("tablist", { name: "Which reviews to show" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((t) => [t.textContent, t.getAttribute("aria-selected")])).toEqual([
      ["Open reviews2", "true"],
      ["Submitted0", "false"],
      ["On the cover5", "false"],
    ]);
    const panel = screen.getByRole("tabpanel", { name: "Open reviews" });
    for (const tab of tabs) {
      expect(tab).toHaveAttribute("aria-controls", panel.id);
    }
    expect(within(panel).getByText("showing open")).toBeInTheDocument();
  });

  it.each([
    ["", "open"],
    ["?stage=cover", "cover"],
    ["?stage=submitted", "submitted"],
    ["?stage=nonsense", "open"],
  ])("reads the stage from %s", (search, stage) => {
    url.search = search;

    renderChips();

    expect(screen.getByText(`showing ${stage}`)).toBeInTheDocument();
  });

  it("writes the chosen stage to the URL, keeping the rest of the query", async () => {
    url.search = "?other=1";
    const { user } = renderChips();

    await user.click(screen.getByRole("tab", { name: /On the cover/ }));

    expect(router.replace).toHaveBeenCalledWith("/dashboard/reviews/mine?other=1&stage=cover", { scroll: false });
  });

  it.each([
    ["ArrowRight", "open", "stage=submitted"],
    ["ArrowRight", "cover", "stage=open"],
    ["ArrowLeft", "open", "stage=cover"],
    ["ArrowLeft", "cover", "stage=submitted"],
    ["Home", "cover", "stage=open"],
    ["End", "open", "stage=cover"],
  ])("%s from %s moves to the %s chip", async (key, from, written) => {
    url.search = `?stage=${from}`;
    const { user } = renderChips();
    screen.getByRole("tab", { selected: true }).focus();

    await user.keyboard(`{${key}}`);

    expect(router.replace).toHaveBeenCalledWith(`/dashboard/reviews/mine?${written}`, { scroll: false });
  });

  it("moves focus to the chip an arrow key chose and lets only the selected chip take Tab", async () => {
    const { user } = renderChips();
    screen.getByRole("tab", { selected: true }).focus();

    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /Submitted/ })).toHaveFocus();
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it("mutes a chip whose count is zero", () => {
    renderChips();

    expect(screen.getByRole("tab", { name: /Submitted/ })).toHaveAttribute("data-empty", "true");
    expect(screen.getByRole("tab", { name: /Open reviews/ })).not.toHaveAttribute("data-empty");
  });
});
