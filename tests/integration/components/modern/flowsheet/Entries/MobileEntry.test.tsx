import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers";
import MobileEntry from "@/src/components/experiences/modern/flowsheet/Entries/MobileEntry";
import { EntryActionsProvider } from "@/src/hooks/entryActions";
import { whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import { createTestV2SpotlightEntry } from "@/tests/fixtures/fixtures";
import { TEST_ENTITY_IDS } from "@/tests/helpers/constants";
import type { FlowsheetSpotlightEntry } from "@/lib/features/flowsheet/types";

const mockUseShowControl = vi.fn();
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

const row = (): FlowsheetSpotlightEntry =>
  convertV2Entry(
    createTestV2SpotlightEntry({
      id: 41,
      show_id: CURRENT_SHOW,
      spotlight_role: "dj",
      spotlight_name: "Porch Static",
    })
  ) as FlowsheetSpotlightEntry;

function setUp(opts: { live: boolean; pastShow: boolean; readOnly?: boolean }) {
  mockUseShowControl.mockReturnValue({ live: opts.live, currentShow: CURRENT_SHOW });
  const update = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <EntryActionsProvider
      value={{
        updateFlowsheet: update,
        removeFromFlowsheet: vi.fn(),
        reorder: vi.fn(),
        pastShow: opts.pastShow,
      }}
    >
      <MobileEntry entry={row()} playing={false} readOnly={opts.readOnly} />
    </EntryActionsProvider>
  );
  return update;
}

describe("MobileEntry who's-on card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames through the live save path with exactly the name payload", async () => {
    const update = setUp({ live: true, pastShow: false });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: whosOnCopy.editName }));
    expect(screen.getByLabelText(whosOnCopy.nameLabel("dj"))).toBeInTheDocument();
    expect(screen.getByText(whosOnCopy.publicNotice("dj"))).toBeInTheDocument();
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Porch Static Duo");
    await user.click(screen.getByRole("button", { name: whosOnCopy.saveName }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toStrictEqual({
      entry_id: 41,
      data: { spotlight_name: "Porch Static Duo" },
    });
  });

  it("renames a past show's row through the past-show actions, never the live mutation", async () => {
    const update = setUp({ live: false, pastShow: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: whosOnCopy.editName }));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Porch Static Duo");
    await user.click(screen.getByRole("button", { name: whosOnCopy.saveName }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(liveFlowsheetUpdate).not.toHaveBeenCalled();
  });

  it("offers no pencil when the viewer is not live and it is not a past show", () => {
    setUp({ live: false, pastShow: false });
    expect(screen.queryByRole("button", { name: whosOnCopy.editName })).toBeNull();
  });

  it("offers no pencil on a read-only card", () => {
    setUp({ live: true, pastShow: false, readOnly: true });
    expect(screen.queryByRole("button", { name: whosOnCopy.editName })).toBeNull();
  });
});
