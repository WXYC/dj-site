import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { SpecialtyShow } from "@wxyc/shared";
import SetTags from "@/src/components/experiences/modern/flowsheet/SetTags";
import StartShowIcon from "@/src/components/experiences/modern/flowsheet/Entries/StartShowIcon";
import { specialtyCopy } from "@/lib/features/specialty/copy";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

const ORANGE_COUNTY = SEED_CATALOG[0];

type OpenShow = {
  id: number;
  start_time: string;
  specialty: SpecialtyShow | null;
  show_name?: string | null;
};

function serve(openShow: OpenShow | null, { onAir = true } = {}) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
      HttpResponse.json({
        entries: [],
        page: 0,
        limit: 1,
        total: 0,
        total_pages: 1,
        on_air: openShow && onAir ? { dj_name: "DJ Test", show_id: openShow.id } : null,
        shows: openShow ? [openShow] : [],
      })
    )
  );
}

const open = (overrides: Partial<OpenShow>): OpenShow => ({
  id: 7,
  start_time: "2026-10-18T16:30:00Z",
  specialty: null,
  ...overrides,
});

async function settle(view: ReturnType<typeof renderWithProviders>) {
  await waitFor(() => expect(view.store.getState().flowsheetApi.queries).not.toEqual({}));
  await new Promise((r) => setTimeout(r, 150));
}

describe("SetTags", () => {
  it("shows the quiet Freeform tag on an untagged set", async () => {
    serve(open({}));
    renderWithProviders(<SetTags />);
    expect(await screen.findByText(specialtyCopy.freeform)).toBeInTheDocument();
  });

  it("shows the program's name, and no Freeform tag, on a tagged set", async () => {
    serve(open({ specialty: ORANGE_COUNTY }));
    renderWithProviders(<SetTags />);
    expect(await screen.findByText(ORANGE_COUNTY.name)).toBeInTheDocument();
    expect(screen.queryByText(specialtyCopy.freeform)).not.toBeInTheDocument();
  });

  it("puts a title that differs from the program name on a second line", async () => {
    serve(open({ specialty: ORANGE_COUNTY, show_name: "Pumpkin Spice Special" }));
    renderWithProviders(<SetTags />);
    expect(await screen.findByText("Pumpkin Spice Special")).toBeInTheDocument();
    expect(screen.getByText(ORANGE_COUNTY.name)).toBeInTheDocument();
  });

  it("does not repeat the program name when the title equals it", async () => {
    serve(open({ specialty: ORANGE_COUNTY, show_name: ORANGE_COUNTY.name }));
    renderWithProviders(<SetTags />);
    await screen.findByText(ORANGE_COUNTY.name);
    expect(screen.getAllByText(ORANGE_COUNTY.name)).toHaveLength(1);
  });

  it("does not render the tile in the tag", async () => {
    serve(open({ specialty: ORANGE_COUNTY }));
    renderWithProviders(<SetTags />);
    await screen.findByText(ORANGE_COUNTY.name);
    expect(screen.queryByTestId("specialty-tile")).not.toBeInTheDocument();
  });

  it.each([
    ["no open show", null, true],
    ["on_air absent", open({}), false],
  ])("renders nothing, never Freeform, for %s", async (_name, show, onAir) => {
    serve(show, { onAir });
    const view = renderWithProviders(<SetTags />);
    await settle(view);
    expect(view.container).toBeEmptyDOMElement();
  });
});

describe("StartShowIcon", () => {
  it("shows the headphones icon while the set is untagged", async () => {
    serve(open({}));
    const view = renderWithProviders(<StartShowIcon showId={7} />);
    await settle(view);
    expect(screen.getByTestId("HeadphonesIcon")).toBeInTheDocument();
    expect(screen.queryByTestId("specialty-tile")).not.toBeInTheDocument();
  });

  it("swaps the headphones for the program's tile once tagged", async () => {
    serve(open({ specialty: ORANGE_COUNTY }));
    renderWithProviders(<StartShowIcon showId={7} />);
    expect(await screen.findByTestId("specialty-tile")).toBeInTheDocument();
    expect(screen.queryByTestId("HeadphonesIcon")).not.toBeInTheDocument();
  });

  it("keeps the headphones on another show's start row", async () => {
    serve(open({ specialty: ORANGE_COUNTY }));
    const view = renderWithProviders(<StartShowIcon showId={3} />);
    await settle(view);
    expect(screen.getByTestId("HeadphonesIcon")).toBeInTheDocument();
    expect(screen.queryByTestId("specialty-tile")).not.toBeInTheDocument();
  });
});
