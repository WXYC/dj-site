import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/lib/test-utils";
import SelectedMatchTracks from "./SelectedMatchTracks";

const ALBUM_ID = 4201;

const mockTracks = (tracks: Array<{ position: string; title: string }>) =>
  server.use(
    http.get(
      `${TEST_BACKEND_URL}/proxy/library/${ALBUM_ID}/tracks`,
      () =>
        HttpResponse.json({
          library_id: ALBUM_ID,
          discogs_release_id: 1,
          source: "discogs",
          tracks: tracks.map((t) => ({
            ...t,
            artist_credit: "Stereolab",
            duration_ms: null,
          })),
        })
    )
  );

describe("SelectedMatchTracks", () => {
  beforeEach(() => {
    mockTracks([
      { position: "A1", title: "Brakhage" },
      { position: "A2", title: "Percolator" },
    ]);
  });

  it("renders the release's tracks", async () => {
    const { findByTestId } = renderWithProviders(
      <SelectedMatchTracks albumId={ALBUM_ID} onPick={vi.fn()} />
    );
    expect(await findByTestId("flowsheet-track-option-A1")).toHaveTextContent(
      "Brakhage"
    );
    expect(await findByTestId("flowsheet-track-option-A2")).toHaveTextContent(
      "Percolator"
    );
  });

  it("calls onPick with the track title and position", async () => {
    const onPick = vi.fn();
    const { findByTestId } = renderWithProviders(
      <SelectedMatchTracks albumId={ALBUM_ID} onPick={onPick} />
    );
    fireEvent.mouseDown(await findByTestId("flowsheet-track-option-A2"));
    expect(onPick).toHaveBeenCalledWith("Percolator", "A2");
  });

  it("renders nothing for an unlinked release", () => {
    const { container } = renderWithProviders(
      <SelectedMatchTracks albumId={-1} onPick={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the release has no tracklist", async () => {
    mockTracks([]);
    const { queryByTestId } = renderWithProviders(
      <SelectedMatchTracks albumId={ALBUM_ID} onPick={vi.fn()} />
    );
    await waitFor(() =>
      expect(queryByTestId("flowsheet-track-picker")).not.toBeInTheDocument()
    );
  });
});
