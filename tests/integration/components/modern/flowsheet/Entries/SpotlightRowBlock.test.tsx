import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers";
import SpotlightRowBlock from "@/src/components/experiences/modern/flowsheet/Entries/SpotlightRowBlock";
import { EntryActionsProvider } from "@/src/hooks/entryActions";
import { whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import { createTestV2SpotlightEntry } from "@/tests/fixtures/fixtures";
import type { FlowsheetSpotlightEntry } from "@/lib/features/flowsheet/types";

const mockUseLiveStatus = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useLiveStatus: () => mockUseLiveStatus(),
  useFlowsheetActions: () => ({
    updateFlowsheet: vi.fn(),
    removeFromFlowsheet: vi.fn(),
    switchEntries: vi.fn(),
  }),
}));

function rowFor(
  role: "performer" | "dj" | "guest" = "performer"
): FlowsheetSpotlightEntry {
  return convertV2Entry(
    createTestV2SpotlightEntry({
      id: 41,
      spotlight_role: role,
      spotlight_name: "Porch Static",
    })
  ) as FlowsheetSpotlightEntry;
}

function setUp(opts: { live: boolean; pastShow: boolean; role?: "performer" | "dj" | "guest" }) {
  mockUseLiveStatus.mockReturnValue({ live: opts.live });
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
      <SpotlightRowBlock entry={rowFor(opts.role)} />
    </EntryActionsProvider>
  );
  return { liveUpdate, pastUpdate };
}

async function rename(next: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /edit name/i }));
  const input = screen.getByRole("textbox");
  await user.clear(input);
  await user.type(input, next);
  return { user, input };
}

describe("SpotlightRowBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the name and its role wording", () => {
    setUp({ live: true, pastShow: false });
    expect(screen.getByText("Porch Static")).toBeInTheDocument();
    expect(screen.getByText("live in the studio")).toBeInTheDocument();
  });

  it("sends exactly the trimmed spotlight_name for the entry on the live flowsheet", async () => {
    const { liveUpdate } = setUp({ live: true, pastShow: false });
    const { user } = await rename("  Porch Static Duo  ");
    await user.click(screen.getByRole("button", { name: /save name/i }));
    expect(liveUpdate).toHaveBeenCalledTimes(1);
    expect(liveUpdate.mock.calls[0][0]).toStrictEqual({
      entry_id: 41,
      data: { spotlight_name: "Porch Static Duo" },
    });
  });

  it("saves through the supplied past-show actions when the show has ended and nobody is live", async () => {
    const { pastUpdate } = setUp({ live: false, pastShow: true });
    const { user } = await rename("Porch Static Duo");
    await user.click(screen.getByRole("button", { name: /save name/i }));
    expect(pastUpdate.mock.calls[0][0]).toStrictEqual({
      entry_id: 41,
      data: { spotlight_name: "Porch Static Duo" },
    });
  });

  it("offers no edit control when the show is not live and not a past show", () => {
    setUp({ live: false, pastShow: false });
    expect(screen.queryByRole("button", { name: /edit name/i })).toBeNull();
  });

  it.each([
    ["blank", "   "],
    ["unchanged", "Porch Static"],
  ])("does not send a %s name", async (_label, value) => {
    const { liveUpdate } = setUp({ live: true, pastShow: false });
    const { user, input } = await rename("x");
    fireEvent.change(input, { target: { value } });
    await user.click(screen.getByRole("button", { name: /save name/i }));
    expect(liveUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["performer" as const, "Name"],
    ["dj" as const, "The name they DJ under"],
    ["guest" as const, "Name"],
  ])("while editing a %s row, shows its label and the public-name notice", async (role, label) => {
    setUp({ live: true, pastShow: false, role });
    await userEvent.setup().click(screen.getByRole("button", { name: /edit name/i }));
    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByText(whosOnCopy.publicNotice(role))).toBeInTheDocument();
  });

  it("never words anything for the DJ as spotlight", async () => {
    setUp({ live: true, pastShow: false });
    await userEvent.setup().click(screen.getByRole("button", { name: /edit name/i }));
    expect(document.body.textContent).not.toMatch(/spotlight/i);
  });
});
