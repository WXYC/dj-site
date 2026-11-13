import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import AlbumCard from "@/src/components/experiences/modern/catalog/album/AlbumCard";
import { RequireDJ } from "@/src/components/shared/Authorization";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

vi.mock("@/src/components/experiences/modern/catalog/album/DiscogsMarkupRenderer", () => ({
  default: () => <span>mocked bio</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/LibraryStatus", () => ({
  default: () => <span>mocked status</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/StreamingLinks", () => ({
  default: () => <span>mocked streaming links</span>,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/Tracklist", () => ({
  default: () => <span>mocked tracklist</span>,
}));
vi.mock("@/src/components/experiences/modern/reviews/ReviewsPanel", () => ({
  default: () => <span>mocked reviews</span>,
}));

// The edit controls are stubbed with drafts of their own, so the assertions
// read the card's view/edit gate and its tabs rather than each control's
// internal role gate. Each stub reports its draft through `onUnsavedChange`
// the way the real controls do, and its Save clears the draft.
const { makeDraftStub } = vi.hoisted(() => ({
  makeDraftStub: (useState: typeof import("react").useState, name: string) =>
    function DraftStub({ onUnsavedChange }: { onUnsavedChange?: (unsaved: boolean) => void }) {
      const [draft, setDraft] = useState("");
      return (
        <span>
          <input
            aria-label={`${name} draft`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onUnsavedChange?.(e.target.value !== "");
            }}
          />
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onUnsavedChange?.(false);
            }}
          >
            Save {name}
          </button>
        </span>
      );
    },
}));

vi.mock("@/src/components/experiences/modern/catalog/album/AlbumEditForm", async () => ({
  default: makeDraftStub((await import("react")).useState, "Details"),
}));
vi.mock("@/src/components/experiences/modern/catalog/album/DiscogsUnavailableControl", async () => ({
  default: makeDraftStub((await import("react")).useState, "Discogs"),
}));
vi.mock("@/src/components/experiences/modern/catalog/album/RotationClassifyControl", async () => ({
  default: makeDraftStub((await import("react")).useState, "Rotation"),
}));
vi.mock(
  "@/src/components/experiences/modern/catalog/album/CompilationCreditsControl",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    default: makeDraftStub((await import("react")).useState, "Credits"),
  }),
);

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<typeof vi.fn>;

const ALL_TABS = ["Details", "Discogs", "Rotation", "Credits"];
// Credits keeps its only draft in a dialog that blocks the tabs while open, so
// it reports nothing and its tab is never marked.
const REPORTING_TABS = ["Details", "Discogs", "Rotation"];

const defaultProps = {
  artworkUrl: "https://example.com/cover.jpg",
  metadata: null,
  metadataLoading: false,
  artistBio: null,
  bioTokens: null,
  artistWikipediaUrl: null,
};

const doga = createTestAlbum({
  id: 4242,
  title: "DOGA",
  artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 12 }),
  label: "Sonamos",
});

const evenCowgirls = createTestAlbum({
  id: 4444,
  title: "Even Cowgirls Get The Blues",
  artist: createTestArtist({ name: "Various Artists - Rock - S", lettercode: "V/A", numbercode: 0 }),
});

const onYourOwnLoveAgain = createTestAlbum({
  id: 4343,
  title: "On Your Own Love Again",
  artist: createTestArtist({ name: "Jessica Pratt", lettercode: "PR", numbercode: 7 }),
  label: "Drag City",
});

function signInAs(role: string) {
  mockFetchOrgRole.mockResolvedValue(role);
  mockUseSession.mockReturnValue({
    data: {
      user: {
        id: "user-1",
        email: "test@wxyc.org",
        name: "Test User",
        username: "testuser",
        role: null,
        emailVerified: true,
      },
      session: { id: "sess-1", userId: "user-1", expiresAt: new Date() },
    },
    isPending: false,
    error: null,
  });
}

function expectNoEditControls() {
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  for (const tab of ALL_TABS) {
    expect(screen.queryByLabelText(`${tab} draft`)).not.toBeInTheDocument();
  }
}

function tabNames() {
  return screen.getAllByRole("tab").map((tab) => tab.textContent);
}

async function openEditor(album = doga) {
  signInAs("musicDirector");
  const view = renderWithProviders(<AlbumCard album={album} {...defaultProps} />);
  await view.user.click(await screen.findByRole("button", { name: "Edit" }));
  return view;
}

describe("AlbumCard view/edit mode", () => {
  beforeEach(() => {
    mockFetchOrgRole.mockReset();
    mockUseSession.mockReset();
  });

  it.each([
    { role: "dj", canEdit: false },
    { role: "musicDirector", canEdit: true },
    { role: "stationManager", canEdit: true },
  ])("opens read-only for $role (Edit button shown: $canEdit)", async ({ role, canEdit }) => {
    signInAs(role);
    // Shown to every signed-in tier once the role has resolved, so its presence
    // proves the card's own gate has decided before Edit's absence is asserted.
    renderWithProviders(
      <>
        <AlbumCard album={doga} {...defaultProps} />
        <RequireDJ>
          <span>role resolved</span>
        </RequireDJ>
      </>,
    );
    await screen.findByText("role resolved");

    if (canEdit) {
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    }
    expectNoEditControls();
    expect(screen.getByText("mocked tracklist")).toBeInTheDocument();
    expect(screen.getByText("mocked reviews")).toBeInTheDocument();
  });

  it.each([
    { kind: "an ordinary release", album: doga, tabs: ["Details", "Discogs", "Rotation"] },
    { kind: "a compilation", album: evenCowgirls, tabs: ALL_TABS },
  ])("shows a tab per control that applies to $kind, opening on Details", async ({ album, tabs }) => {
    await openEditor(album);

    expect(tabNames()).toEqual(tabs);
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Details draft")).toBeVisible();
  });

  it("swaps the read-only body for the editor, keeping the header", async () => {
    await openEditor();

    expect(screen.getByText("mocked status")).toBeInTheDocument();
    expect(screen.getByText("mocked tracklist")).not.toBeVisible();
    expect(screen.queryByText("mocked reviews")).not.toBeInTheDocument();
    expect(screen.queryByText("mocked streaming links")).not.toBeInTheDocument();
  });

  // Checking the Discogs link is the one edit task that needs the release's
  // tracklist, so it is shown there, read-only, and nowhere else in the editor.
  it.each(ALL_TABS)("shows the tracklist under the %s tab only if it is Discogs", async (tab) => {
    const { user } = await openEditor(evenCowgirls);

    await user.click(screen.getByRole("tab", { name: tab }));

    const panel = screen.getByRole("tabpanel");
    if (tab === "Discogs") {
      expect(within(panel).getByText("mocked tracklist")).toBeInTheDocument();
    } else {
      expect(within(panel).queryByText("mocked tracklist")).not.toBeInTheDocument();
    }
    expect(screen.getAllByText("mocked tracklist")).toHaveLength(1);
  });

  it.each(ALL_TABS)("keeps the %s draft through a switch to another tab and back", async (tab) => {
    const { user } = await openEditor(evenCowgirls);
    const elsewhere = tab === "Details" ? "Rotation" : "Details";

    await user.click(screen.getByRole("tab", { name: tab }));
    await user.type(screen.getByLabelText(`${tab} draft`), "half-typed");
    await user.click(screen.getByRole("tab", { name: elsewhere }));
    expect(screen.getByLabelText(`${tab} draft`)).not.toBeVisible();
    await user.click(screen.getByRole("tab", { name: new RegExp(`^${tab}`) }));

    expect(screen.getByLabelText(`${tab} draft`)).toHaveValue("half-typed");
  });

  it.each(REPORTING_TABS)("marks the %s tab while it holds unsaved changes", async (tab) => {
    const { user } = await openEditor(evenCowgirls);

    await user.click(screen.getByRole("tab", { name: tab }));
    await user.type(screen.getByLabelText(`${tab} draft`), "x");

    expect(screen.getByRole("tab", { name: `${tab}, unsaved changes` })).toBeInTheDocument();
    for (const other of ALL_TABS.filter((name) => name !== tab)) {
      expect(screen.getByRole("tab", { name: other })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: `Save ${tab}` }));

    expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
  });

  it("returns to the read-only card on Close editor, and reopens on Details", async () => {
    const { user } = await openEditor();

    await user.click(screen.getByRole("tab", { name: "Rotation" }));
    await user.click(screen.getByRole("button", { name: "Close editor" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectNoEditControls();
    expect(screen.getByText("mocked tracklist")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  });

  it("closes without asking once every draft is saved", async () => {
    const { user } = await openEditor();

    await user.type(screen.getByLabelText("Details draft"), "x");
    await user.click(screen.getByRole("button", { name: "Save Details" }));
    await user.click(screen.getByRole("button", { name: "Close editor" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectNoEditControls();
  });

  it("asks before closing over an unsaved draft, and keeps editing on request", async () => {
    const { user } = await openEditor();

    await user.click(screen.getByRole("tab", { name: "Rotation" }));
    await user.type(screen.getByLabelText("Rotation draft"), "H");
    await user.click(screen.getByRole("button", { name: "Close editor" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Discard unsaved changes?" });
    expect(within(dialog).getByRole("button", { name: "Keep editing" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Rotation draft")).toHaveValue("H");
    expect(screen.getByRole("tab", { name: "Rotation, unsaved changes" })).toBeInTheDocument();
  });

  it("discards the drafts and closes when asked to", async () => {
    const { user } = await openEditor();

    await user.click(screen.getByRole("tab", { name: "Rotation" }));
    await user.type(screen.getByLabelText("Rotation draft"), "H");
    await user.click(screen.getByRole("button", { name: "Close editor" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectNoEditControls();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Rotation draft")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Close editor" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectNoEditControls();
  });

  // The modal around the card asks before its own exits, so it is told whether any tab is unsaved.
  it("reports whether the editor holds an unsaved draft, through saving and discarding", async () => {
    signInAs("musicDirector");
    const onUnsavedChange = vi.fn();
    const { user } = renderWithProviders(
      <AlbumCard album={doga} {...defaultProps} onUnsavedChange={onUnsavedChange} />,
    );
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(onUnsavedChange).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText("Details draft"), "x");
    expect(onUnsavedChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Save Details" }));
    expect(onUnsavedChange).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText("Details draft"), "y");
    expect(onUnsavedChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Close editor" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(onUnsavedChange).toHaveBeenLastCalledWith(false);
  });

  it("tells assistive tech whether the editor is open and which region it controls", async () => {
    signInAs("musicDirector");
    const { user } = renderWithProviders(<AlbumCard album={doga} {...defaultProps} />);

    const edit = await screen.findByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-expanded", "false");

    await user.click(edit);

    const close = screen.getByRole("button", { name: "Close editor" });
    expect(close).toHaveAttribute("aria-expanded", "true");
    const controlled = document.getElementById(close.getAttribute("aria-controls") ?? "");
    expect(controlled).not.toBeNull();
    expect(within(controlled!).getByRole("tablist")).toBeInTheDocument();
  });

  // The control is the only way to clear the flag, so a flagged release must
  // still reach it.
  it("reaches the Discogs availability control on a release flagged not on Discogs", async () => {
    const { user } = await openEditor(
      createTestAlbum({ ...doga, discogsUnavailable: true, discogsUnavailableNote: "embargoed" }),
    );

    await user.click(screen.getByRole("tab", { name: "Discogs" }));

    expect(screen.getByLabelText("Discogs draft")).toBeVisible();
  });
});
