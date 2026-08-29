import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));

import VariousArtistsCard from "@/src/components/experiences/classic/catalog/VariousArtistsCard";

const BUCKET_ID = 4211;
const UMBRELLA_BUCKET_ID = 19923;
const GENRE_ID = 3;

const bucket = {
  artist_id: BUCKET_ID,
  artist_name: "Soundtracks - L",
  alphabetical_name: "Soundtracks - L",
  genre_id: GENRE_ID,
  code_letters: "V/A",
  code_artist_number: 0,
};

function release(overrides: Record<string, unknown> = {}) {
  return {
    id: 900,
    last_modified: "2024-06-15T19:04:05.000Z",
    format_name: "CD",
    genre_id: GENRE_ID,
    code_letters: "V/A",
    code_artist_number: 0,
    code_number: 5,
    code_volume_letters: null,
    album_title: "Edits",
    alternate_artist_name: null,
    ...overrides,
  };
}

function mockCard(artistId: number, body: unknown = bucket, status = 200) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/${artistId}`, () =>
      HttpResponse.json(body as object, { status }),
    ),
  );
}

function mockReleases(
  artistId: number,
  releases: unknown[] = [release()],
  total = releases.length,
) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/${artistId}/releases`, () =>
      HttpResponse.json({
        artist_id: artistId,
        releases,
        total,
        page: 0,
        totalPages: Math.max(1, Math.ceil(total / 50)),
      }),
    ),
  );
}

function mockGenres() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([{ id: GENRE_ID, genre_name: "Rock" }]),
    ),
  );
}

function mockFormats() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/formats`, () =>
      HttpResponse.json([
        { id: 1, format_name: "CD" },
        { id: 2, format_name: "  " },
        { id: 3, format_name: "Vinyl" },
      ]),
    ),
  );
}

function mockAll(artistId = BUCKET_ID) {
  mockCard(artistId);
  mockReleases(artistId);
  mockGenres();
  mockFormats();
}

describe("classic VariousArtistsCard — variousArtistsCardModify.jsp", () => {
  beforeEach(() => {
    replace.mockClear();
    mockAll();
  });

  it("heads the section with the bucket's alphabetical name", async () => {
    renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

    const header = await screen.findByTestId("va-bucket-header");
    expect(within(header).getByText("Soundtracks - L")).toBeDefined();
  });

  it("reports the release count from the server's total, not the rows on this page", async () => {
    mockReleases(BUCKET_ID, [release()], 137);
    renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

    const header = await screen.findByTestId("va-bucket-header");
    expect(within(header).getByText("137")).toBeDefined();
  });

  it("offers no name edit — the bucket header is a shelf section, not a performer", async () => {
    renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

    await screen.findByTestId("va-bucket-header");
    expect(screen.queryByRole("button", { name: /modify this artist/i })).toBeNull();
    expect(screen.queryByDisplayValue("Soundtracks - L")).toBeNull();
  });

  describe("add-release form", () => {
    it("carries the JSP's fields in order, with Album Artist between the alternate name and the format", async () => {
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      const form = await screen.findByTestId("va-add-release-form");
      const labels = within(form)
        .getAllByRole("cell")
        .map((cell) => cell.textContent?.trim())
        .filter((text): text is string => !!text && text.endsWith(":"));

      expect(labels).toEqual([
        "Add a Library Release for This Section:",
        "Library Code:",
        "Title of Release:",
        "Alternate Artist Name:",
        "Album Artist:",
        "Label:",
        "Format:",
      ]);
    });

    it("states that Album Artist cannot be set here rather than offering an input that discards it", async () => {
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      const note = await screen.findByTestId("va-album-artist-unavailable");
      expect(note.textContent).toMatch(/cannot be set here/i);
      expect(screen.queryByLabelText(/album artist/i)).toBeNull();
    });

    it("refuses an empty title with the legacy validation message", async () => {
      const user = userEvent.setup();
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      const form = await screen.findByTestId("va-add-release-form");
      await user.click(within(form).getByRole("button", { name: /add a new library release/i }));

      expect(
        await screen.findByText("Please enter a title before adding this release."),
      ).toBeDefined();
    });

    it("files the release against the bucket's own id, never its name", async () => {
      const user = userEvent.setup();
      let posted: Record<string, unknown> | undefined;
      server.use(
        http.post(`${TEST_BACKEND_URL}/library`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 1, code_number: 12, code_volume_letters: null });
        }),
      );

      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);
      const form = await screen.findByTestId("va-add-release-form");

      await user.type(within(form).getByLabelText(/title of release/i), "Edits");
      await user.type(within(form).getByLabelText(/^label:/i), "self-released");
      await user.selectOptions(within(form).getByLabelText(/format/i), "1");
      await user.click(within(form).getByRole("button", { name: /add a new library release/i }));

      await waitFor(() => expect(posted).toBeDefined());
      expect(posted?.artist_id).toBe(BUCKET_ID);
      expect(posted).not.toHaveProperty("artist_name");
    });

    it("reports the code the release was filed under once it is assigned", async () => {
      const user = userEvent.setup();
      server.use(
        http.post(`${TEST_BACKEND_URL}/library`, () =>
          HttpResponse.json({ id: 1, code_number: 12, code_volume_letters: null }),
        ),
      );

      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);
      const form = await screen.findByTestId("va-add-release-form");

      await user.type(within(form).getByLabelText(/title of release/i), "Edits");
      await user.type(within(form).getByLabelText(/^label:/i), "self-released");
      await user.selectOptions(within(form).getByLabelText(/format/i), "1");
      await user.click(within(form).getByRole("button", { name: /add a new library release/i }));

      expect(await screen.findByText(/Filed as .*12/)).toBeDefined();
    });

    it("omits blank-named formats from the dropdown", async () => {
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      const form = await screen.findByTestId("va-add-release-form");
      const options = within(form)
        .getAllByRole("option")
        .map((option) => option.textContent);
      expect(options).toEqual(["CD", "Vinyl"]);
    });
  });

  describe("the umbrella bucket", () => {
    it("hides the add-release form, because a release filed there sits on no lettered shelf", async () => {
      mockAll(UMBRELLA_BUCKET_ID);
      mockCard(UMBRELLA_BUCKET_ID, {
        ...bucket,
        artist_id: UMBRELLA_BUCKET_ID,
        artist_name: "Various Artists",
        alphabetical_name: "Various Artists",
      });

      renderWithProviders(<VariousArtistsCard artistId={UMBRELLA_BUCKET_ID} />);

      await screen.findByTestId("va-bucket-header");
      expect(screen.queryByTestId("va-add-release-form")).toBeNull();
    });

    it("still lists what is already filed there", async () => {
      mockAll(UMBRELLA_BUCKET_ID);
      mockCard(UMBRELLA_BUCKET_ID, {
        ...bucket,
        artist_id: UMBRELLA_BUCKET_ID,
        alphabetical_name: "Various Artists",
      });

      renderWithProviders(<VariousArtistsCard artistId={UMBRELLA_BUCKET_ID} />);

      const table = await screen.findByTestId("va-release-table");
      expect(within(table).getByText("Edits")).toBeDefined();
    });
  });

  describe("release table", () => {
    it("renders the JSP's five columns", async () => {
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      const table = await screen.findByTestId("va-release-table");
      const headers = within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent);
      expect(headers).toEqual([
        "Time Last Modified",
        "Format",
        "Code",
        "Title of Release",
        "Alternate Artist Name",
      ]);
    });

    it("links each title to its release screen", async () => {
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      const table = await screen.findByTestId("va-release-table");
      expect(within(table).getByRole("link", { name: "Edits" })).toHaveAttribute(
        "href",
        "/dashboard/library/release/900",
      );
    });

    it("shows the JSP's empty-shelf message rather than a bare table", async () => {
      mockReleases(BUCKET_ID, [], 0);
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      expect(
        await screen.findByText("The artist does not have any library releases"),
      ).toBeDefined();
    });

    it("says the list is incomplete when the releases cannot be loaded, rather than showing an empty shelf", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/${BUCKET_ID}/releases`, () =>
          HttpResponse.json({ message: "boom" }, { status: 500 }),
        ),
      );
      renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

      const error = await screen.findByTestId("va-release-table-error");
      expect(error.textContent).toMatch(/not a complete list/i);
      expect(screen.queryByText("The artist does not have any library releases")).toBeNull();
    });
  });

  it("sends an ordinary artist reaching this URL on to the artist card", async () => {
    mockCard(BUCKET_ID, {
      ...bucket,
      artist_name: "Juana Molina",
      alphabetical_name: "Molina, Juana",
      code_letters: "MO",
      code_artist_number: 12,
    });

    renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/dashboard/library/artist/${BUCKET_ID}`),
    );
    expect(screen.queryByTestId("va-add-release-form")).toBeNull();
  });

  it("says the section could not be loaded when the card request fails", async () => {
    mockCard(BUCKET_ID, { message: "boom" }, 500);
    renderWithProviders(<VariousArtistsCard artistId={BUCKET_ID} />);

    expect(await screen.findByTestId("various-artists-card-error")).toBeDefined();
  });
});
