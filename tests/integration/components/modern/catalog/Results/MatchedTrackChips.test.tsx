import { describe, it, expect, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import type { TrackMatchHint } from "@/lib/features/catalog/types";
import { MatchedTrackChips } from "@/src/components/experiences/modern/catalog/Results/MatchedTrackChips";

const FLAG_KEY = "NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED";

function renderChips(matched_via: TrackMatchHint[] | undefined) {
  renderWithProviders(<MatchedTrackChips matched_via={matched_via} />);
}

describe("Modern MatchedTrackChips", () => {
  it("renders nothing when matched_via is undefined", () => {
    const { container } = renderWithProviders(
      <MatchedTrackChips matched_via={undefined} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when matched_via is an empty array", () => {
    const { container } = renderWithProviders(
      <MatchedTrackChips matched_via={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a single chip with 'matched on track: <title>' when one hint is present", () => {
    renderChips([
      {
        source: "cta",
        title: "In a Sentimental Mood",
        artist_credit: "Duke Ellington & John Coltrane",
        confidence: 1.0,
      },
    ]);
    expect(
      screen.getByText("matched on track: In a Sentimental Mood")
    ).toBeDefined();
  });

  it("exposes artist_credit and position in the chip aria-label", () => {
    renderChips([
      {
        source: "discogs_master",
        title: "In a Sentimental Mood",
        artist_credit: "Duke Ellington & John Coltrane",
        position: "A1",
        confidence: 0.92,
      },
    ]);
    const labelled = screen.getByLabelText(
      /matched on track: In a Sentimental Mood by Duke Ellington & John Coltrane \(A1\)/
    );
    expect(labelled).toBeDefined();
  });

  it("renders up to 3 matched-track chips inline", () => {
    renderChips([
      { source: "cta", title: "Track One", confidence: 1.0 },
      { source: "discogs_master", title: "Track Two", confidence: 0.9 },
      { source: "discogs_release", title: "Track Three", confidence: 0.8 },
    ]);
    expect(screen.getByText("matched on track: Track One")).toBeDefined();
    expect(screen.getByText("matched on track: Track Two")).toBeDefined();
    expect(screen.getByText("matched on track: Track Three")).toBeDefined();
    expect(screen.queryByText(/\+\d+ more/)).toBeNull();
  });

  it("collapses overflow past 3 hints into a '+N more' chip", () => {
    renderChips([
      { source: "cta", title: "Track One", confidence: 1.0 },
      { source: "discogs_master", title: "Track Two", confidence: 0.9 },
      { source: "discogs_release", title: "Track Three", confidence: 0.8 },
      { source: "discogs_release", title: "Track Four", confidence: 0.7 },
      { source: "library_identity", title: "Track Five", confidence: 0.6 },
    ]);
    expect(screen.getByText("matched on track: Track One")).toBeDefined();
    expect(screen.getByText("matched on track: Track Two")).toBeDefined();
    expect(screen.getByText("matched on track: Track Three")).toBeDefined();
    expect(screen.queryByText("matched on track: Track Four")).toBeNull();
    expect(screen.queryByText("matched on track: Track Five")).toBeNull();
    expect(screen.getByText("+2 more")).toBeDefined();
  });

  it("renders chips as keyboard-focusable elements", () => {
    renderChips([
      { source: "cta", title: "In a Sentimental Mood", confidence: 1.0 },
    ]);
    const chip = screen
      .getByText("matched on track: In a Sentimental Mood")
      .closest("[tabindex]");
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute("tabindex")).toBe("0");
  });

  it("renders the +N more chip as keyboard-focusable with overflow titles in its aria-label", () => {
    renderChips([
      { source: "cta", title: "Track One", confidence: 1.0 },
      { source: "discogs_master", title: "Track Two", confidence: 0.9 },
      { source: "discogs_release", title: "Track Three", confidence: 0.8 },
      { source: "discogs_release", title: "Track Four", confidence: 0.7 },
    ]);
    const more = screen.getByText("+1 more").closest("[tabindex]");
    expect(more).not.toBeNull();
    expect(more?.getAttribute("tabindex")).toBe("0");
    expect(more?.getAttribute("aria-label")).toContain("Track Four");
  });

  describe("CATALOG_TRACK_SEARCH_UI_ENABLED flag", () => {
    afterEach(() => {
      process.env[FLAG_KEY] = "true";
    });

    it.each(["false", "0", undefined])(
      "renders nothing when the flag is %s, even with hints present",
      (value) => {
        if (value === undefined) {
          delete process.env[FLAG_KEY];
        } else {
          process.env[FLAG_KEY] = value;
        }
        const { container } = renderWithProviders(
          <MatchedTrackChips
            matched_via={[
              {
                source: "cta",
                title: "In a Sentimental Mood",
                confidence: 1.0,
              },
            ]}
          />
        );
        expect(container.firstChild).toBeNull();
      }
    );
  });
});
