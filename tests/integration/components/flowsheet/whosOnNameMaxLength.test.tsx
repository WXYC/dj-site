import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import EntryForm from "@/src/components/experiences/classic/flowsheet/EntryForm";
import WhosOnFields from "@/src/components/experiences/modern/flowsheet/Search/WhosOnFields";
import SpotlightRowBlock from "@/src/components/experiences/modern/flowsheet/Entries/SpotlightRowBlock";
import { EntryActionsProvider } from "@/src/hooks/entryActions";
import { WHOS_ON_NAME_MAX_LENGTH, whosOnCopy } from "@/lib/features/flowsheet/whos-on-copy";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import type { FlowsheetSpotlightEntry } from "@/lib/features/flowsheet/types";
import {
  createTestV2SpotlightEntry,
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

const NOON = "2026-10-18T16:30:00Z";

async function classicComposerName() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json({
        entries: [],
        page: 0,
        limit: 1,
        total: 0,
        total_pages: 1,
        on_air: { dj_name: "DJ Test", show_id: 7 },
        shows: [
          { id: 7, start_time: NOON, specialty: { ...SEED_CATALOG[0], default_spotlight_role: "guest" } },
        ],
      })
    )
  );
  renderWithProviders(<EntryForm />);
  const select = (await screen.findByLabelText("Add a")) as HTMLSelectElement;
  await waitFor(() => expect(select.options.length).toBeGreaterThan(3));
  await userEvent.selectOptions(select, "guest");
  return screen.getByRole("textbox");
}

function modernComposerName() {
  renderWithProviders(
    <WhosOnFields role="guest" onRoleChange={() => {}} name="" onNameChange={() => {}} refusal={null} />
  );
  return screen.getByRole("textbox");
}

async function modernRowRenameName() {
  const entry = convertV2Entry(
    createTestV2SpotlightEntry({ id: 41, spotlight_role: "performer", spotlight_name: "Porch Static" })
  ) as FlowsheetSpotlightEntry;
  renderWithProviders(
    <EntryActionsProvider
      value={{ updateFlowsheet: () => {}, removeFromFlowsheet: () => {}, reorder: () => {}, pastShow: true }}
    >
      <SpotlightRowBlock entry={entry} />
    </EntryActionsProvider>
  );
  await userEvent.setup().click(screen.getByRole("button", { name: whosOnCopy.editName }));
  return screen.getByRole("textbox");
}

describe("who's-on name inputs", () => {
  it("matches the server's limit", () => {
    expect(WHOS_ON_NAME_MAX_LENGTH).toBe(128);
  });

  it.each([
    ["modern composer", async () => modernComposerName()],
    ["modern row rename", modernRowRenameName],
    ["classic composer", classicComposerName],
  ])("caps the %s at the shared limit", async (_label, nameInput) => {
    expect(await nameInput()).toHaveAttribute("maxlength", String(WHOS_ON_NAME_MAX_LENGTH));
  });
});
