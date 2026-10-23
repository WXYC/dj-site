import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers";
import SpotlightRowBlock from "@/src/components/experiences/modern/flowsheet/Entries/SpotlightRowBlock";
import { EntryActionsProvider } from "@/src/hooks/entryActions";
import { whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import { createTestV2SpotlightEntry } from "@/tests/fixtures/fixtures";
import { TEST_ENTITY_IDS } from "@/tests/helpers/constants";
import type { FlowsheetSpotlightEntry } from "@/lib/features/flowsheet/types";

const mockUseShowControl = vi.fn();
// The live mutations the hook would hand a row that was not given its own actions.
const liveFlowsheetUpdate = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
  useFlowsheetActions: () => ({
    updateFlowsheet: liveFlowsheetUpdate,
    removeFromFlowsheet: vi.fn(),
    switchEntries: vi.fn(),
  }),
}));

const CURRENT_SHOW = TEST_ENTITY_IDS.SHOW.CURRENT_SHOW;
const EARLIER_SHOW = CURRENT_SHOW + 1000;

function rowFor(
  role: "performer" | "dj" | "guest" = "performer",
  showId: number = CURRENT_SHOW
): FlowsheetSpotlightEntry {
  return convertV2Entry(
    createTestV2SpotlightEntry({
      id: 41,
      show_id: showId,
      spotlight_role: role,
      spotlight_name: "Porch Static",
    })
  ) as FlowsheetSpotlightEntry;
}

function setUp(opts: {
  live: boolean;
  pastShow: boolean;
  role?: "performer" | "dj" | "guest";
  showId?: number;
}) {
  mockUseShowControl.mockReturnValue({ live: opts.live, currentShow: CURRENT_SHOW });
  const liveUpdate = vi.fn();
  const pastUpdate = vi.fn();
  renderWithProviders(
    <EntryActionsProvider
      value={{
        updateFlowsheet: opts.pastShow ? pastUpdate : liveUpdate,
        removeFromFlowsheet: vi.fn(),
        reorder: vi.fn(),
        pastShow: opts.pastShow,
      }}
    >
      <SpotlightRowBlock entry={rowFor(opts.role, opts.showId)} />
    </EntryActionsProvider>
  );
  return { liveUpdate, pastUpdate };
}

async function rename(next: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: whosOnCopy.editName }));
  const input = screen.getByRole("textbox");
  await user.clear(input);
  await user.type(input, next);
  return { user, input };
}

describe("SpotlightRowBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers an edit control on the live flowsheet for the current show's row", () => {
    setUp({ live: true, pastShow: false });
    expect(screen.getByRole("button", { name: whosOnCopy.editName })).toBeInTheDocument();
  });

  it("shows the name and its role wording", () => {
    setUp({ live: true, pastShow: false });
    expect(screen.getByText("Porch Static")).toBeInTheDocument();
    expect(screen.getByText("live in the studio")).toBeInTheDocument();
  });

  it("sends exactly the trimmed spotlight_name for the entry on the live flowsheet", async () => {
    const { liveUpdate } = setUp({ live: true, pastShow: false });
    const { user } = await rename("  Porch Static Duo  ");
    await user.click(screen.getByRole("button", { name: whosOnCopy.saveName }));
    expect(liveUpdate).toHaveBeenCalledTimes(1);
    expect(liveUpdate.mock.calls[0][0]).toStrictEqual({
      entry_id: 41,
      data: { spotlight_name: "Porch Static Duo" },
    });
  });

  it("saves through the supplied past-show actions when the show has ended and nobody is live", async () => {
    const { pastUpdate } = setUp({ live: false, pastShow: true });
    const { user } = await rename("Porch Static Duo");
    await user.click(screen.getByRole("button", { name: whosOnCopy.saveName }));
    expect(pastUpdate).toHaveBeenCalledTimes(1);
    expect(pastUpdate.mock.calls[0][0]).toStrictEqual({
      entry_id: 41,
      data: { spotlight_name: "Porch Static Duo" },
    });
    expect(liveFlowsheetUpdate).not.toHaveBeenCalled();
  });

  it("offers an edit control on a past-show row whichever show is current", () => {
    setUp({ live: false, pastShow: true, showId: EARLIER_SHOW });
    expect(screen.getByRole("button", { name: whosOnCopy.editName })).toBeInTheDocument();
  });

  it("offers no edit control on the live flowsheet for a row from an earlier show", () => {
    setUp({ live: true, pastShow: false, showId: EARLIER_SHOW });
    expect(screen.getByText("Porch Static")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: whosOnCopy.editName })).toBeNull();
  });

  it("offers no edit control for the current show's row when the viewer is not live", () => {
    setUp({ live: false, pastShow: false });
    expect(screen.queryByRole("button", { name: whosOnCopy.editName })).toBeNull();
  });

  it("offers no edit control when the show is not live and not a past show", () => {
    setUp({ live: false, pastShow: false });
    expect(screen.queryByRole("button", { name: whosOnCopy.editName })).toBeNull();
  });

  it.each([
    ["blank", "   "],
    ["unchanged", "Porch Static"],
  ])("does not send a %s name", async (_label, value) => {
    const { liveUpdate } = setUp({ live: true, pastShow: false });
    const { user, input } = await rename("x");
    fireEvent.change(input, { target: { value } });
    await user.click(screen.getByRole("button", { name: whosOnCopy.saveName }));
    expect(liveUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["performer" as const, "Name"],
    ["dj" as const, "The name they DJ under"],
    ["guest" as const, "Name"],
  ])("while editing a %s row, shows its label and the public-name notice", async (role, label) => {
    setUp({ live: true, pastShow: false, role });
    await userEvent.setup().click(screen.getByRole("button", { name: whosOnCopy.editName }));
    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByText(whosOnCopy.publicNotice(role))).toBeInTheDocument();
  });

  it("never words anything for the DJ as spotlight", async () => {
    setUp({ live: true, pastShow: false });
    await userEvent.setup().click(screen.getByRole("button", { name: whosOnCopy.editName }));
    expect(document.body.textContent).not.toMatch(/spotlight/i);
  });
});
