import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import FormSectionCard from "@/src/components/shared/FormSectionCard";

describe("FormSectionCard", () => {
  it("renders title, description, children, and data-testid", () => {
    renderWithProviders(
      <FormSectionCard
        title="Artist"
        description="Pick a genre first."
        data-testid="test-section-card"
      >
        <span>child field</span>
      </FormSectionCard>
    );

    expect(screen.getByText("Artist")).toBeInTheDocument();
    expect(screen.getByText("Pick a genre first.")).toBeInTheDocument();
    expect(screen.getByText("child field")).toBeInTheDocument();
    expect(screen.getByTestId("test-section-card")).toBeInTheDocument();
    expect(screen.getByTestId("test-section-card").className).toMatch(
      /MuiCard-root/
    );
  });

  it("renders footer when provided", () => {
    renderWithProviders(
      <FormSectionCard title="Album" footer={<button type="button">Save</button>}>
        <span>fields</span>
      </FormSectionCard>
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  // Asserting on the DOM relationship, not mere co-presence: the action being
  // beside the title is the whole point of the slot, and a card-wide
  // "both exist somewhere" check passes just as well when the button renders
  // below the children.
  it("renders an action next to the title in the header when provided", () => {
    renderWithProviders(
      <FormSectionCard
        title="Per-track credits"
        action={<button type="button">Import from Discogs</button>}
        data-testid="action-card"
      >
        <span>fields</span>
      </FormSectionCard>
    );

    const header = screen.getByText("Per-track credits")
      .parentElement as HTMLElement;
    // The header has to be its own row rather than the card body itself:
    // scoping the button lookup to the body would still find an action
    // rendered below the children, which is the placement this pins against.
    expect(header).not.toBe(
      screen.getByTestId("action-card").firstElementChild
    );
    expect(header.className).toMatch(/MuiStack-root/);
    expect(
      within(header).getByRole("button", { name: "Import from Discogs" })
    ).toBeInTheDocument();
  });

  // The three adopters that pass no action (DiscogsUnavailableControl,
  // AlbumEditForm, RotationClassifyControl) must keep the pre-slot DOM. A
  // one-child row Stack would render them identically to the eye but turn the
  // title into a shrink-to-fit flex item, changing long-title wrapping, so pin
  // the title's parent rather than looking for an absent button.
  it("leaves the title outside any header row when no action is provided", () => {
    renderWithProviders(
      <FormSectionCard title="Album" data-testid="no-action-card">
        <span>fields</span>
      </FormSectionCard>
    );

    const title = screen.getByText("Album");
    expect(title.parentElement).toBe(screen.getByTestId("no-action-card").firstElementChild);
    expect(title.parentElement?.className).not.toMatch(/MuiStack-root/);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("dims and blocks pointer events when disabled", () => {
    renderWithProviders(
      <FormSectionCard title="Album" disabled data-testid="disabled-card">
        <span>fields</span>
      </FormSectionCard>
    );

    expect(screen.getByTestId("disabled-card")).toHaveStyle({
      "pointer-events": "none",
    });
  });
});
