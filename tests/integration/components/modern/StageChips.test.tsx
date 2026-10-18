import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  { id: "published", label: "Published", count: 5 },
] as const;

const renderChips = () =>
  renderWithProviders(
    <StageChips label="Which reviews to show" stages={STAGES} fallback="open">
      {(stage) => <p>{`showing ${stage}`}</p>}
    </StageChips>,
  );

// A choice is written with the native History API, which the App Router syncs to useSearchParams; the router itself is never asked.
let replaceState: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  router.replace.mockClear();
  url.search = "";
  replaceState = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  replaceState.mockRestore();
});

describe("StageChips", () => {
  it("is a named tablist of tabs, one selected, with a tabpanel named by the selected chip", () => {
    renderChips();

    const tablist = screen.getByRole("tablist", { name: "Which reviews to show" });
    const tabs = within(tablist).getAllByRole("tab");
    // A screen reader hears each count after a comma, never run into the label ("Open reviews2").
    expect(["Open reviews, 2", "Submitted, 0", "Published, 5"].map((name) => within(tablist).getByRole("tab", { name }))).toEqual(tabs);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    const panel = screen.getByRole("tabpanel", { name: "Open reviews" });
    for (const tab of tabs) {
      expect(tab).toHaveAttribute("aria-controls", panel.id);
    }
    expect(within(panel).getByText("showing open")).toBeInTheDocument();
    // An empty stage's panel can still take Tab, so a keyboard user reaches what it says.
    expect(panel).toHaveAttribute("tabindex", "0");
  });

  it.each([
    ["", "open"],
    ["?stage=published", "published"],
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

    await user.click(screen.getByRole("tab", { name: /Published/ }));

    expect(replaceState).toHaveBeenCalledWith(null, "", "/dashboard/reviews/mine?other=1&stage=published");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["ArrowRight", "open", "stage=submitted"],
    ["ArrowRight", "published", "stage=open"],
    ["ArrowLeft", "open", "stage=published"],
    ["ArrowLeft", "published", "stage=submitted"],
    ["Home", "published", "stage=open"],
    ["End", "open", "stage=published"],
  ])("%s from %s moves to the %s chip", async (key, from, written) => {
    url.search = `?stage=${from}`;
    const { user } = renderChips();
    screen.getByRole("tab", { selected: true }).focus();

    await user.keyboard(`{${key}}`);

    expect(replaceState).toHaveBeenCalledWith(null, "", `/dashboard/reviews/mine?${written}`);
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
