import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import RotationImportScreen from "@/src/components/experiences/classic/rotation/RotationImportScreen";

const LIBRARY = `${TEST_BACKEND_URL}/library`;

const ROTATION_ROW = {
  id: 6002,
  album_id: null,
  rotation_bin: "L",
  add_date: "2026-01-10",
  kill_date: "2026-02-01",
  artist_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  format_id: 3,
  label_id: null,
};

const MATCH = {
  id: 771,
  artist_name: "Chuquimamani-Condori",
  code_letters: "CHU",
  code_number: 12,
  genre_id: 5,
  genre_name: "Electronic",
};

function mockRotationRow(row: Record<string, unknown> = ROTATION_ROW) {
  server.use(http.get(`${LIBRARY}/rotation/:id`, () => HttpResponse.json(row)));
}

function mockMatches(artists: Record<string, unknown>[]) {
  server.use(http.get(`${LIBRARY}/artists/search`, () => HttpResponse.json({ artists })));
}

function mockReleases(releases: Record<string, unknown>[]) {
  server.use(
    http.get(`${LIBRARY}/artists/:id/releases`, () =>
      HttpResponse.json({ artist_id: 771, releases, total: releases.length, page: 0, totalPages: 1 }),
    ),
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockRotationRow();
  mockMatches([]);
  mockReleases([]);
  server.use(
    http.get(`${LIBRARY}/formats`, () =>
      HttpResponse.json([
        { id: 3, format_name: "CD" },
        { id: 4, format_name: "LP" },
      ]),
    ),
    http.get(`${LIBRARY}/genres`, () =>
      HttpResponse.json([
        { id: 5, genre_name: "Electronic" },
        { id: 11, genre_name: "Rock" },
      ]),
    ),
  );
});

describe("classic RotationImportScreen — rotationReleaseImport.jsp, the screen's chrome and summary", () => {
  // Xerox assertion against `rotationReleaseImport.jsp`: the two header
  // links, the heading, and the Rotation Release summary table's seven rows
  // in the JSP's order.
  it("renders the JSP's header links, heading, and summary rows in order", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    const summary = await screen.findByRole("table", { name: "Rotation Release" });
    expect(
      within(summary).getAllByRole("rowheader").map((cell) => cell.textContent),
    ).toEqual(["Artist:", "Title:", "Label:", "Format:", "Rotation:", "Added:", "Killed:"]);

    expect(screen.getByRole("link", { name: "Back to Import Queue" })).toHaveAttribute(
      "href",
      "/dashboard/rotation?status=uncataloged",
    );
    expect(screen.getByRole("link", { name: "All Rotation Releases" })).toHaveAttribute(
      "href",
      "/dashboard/rotation",
    );
    expect(
      screen.getByRole("heading", { name: "Import Rotation Release to Library" }),
    ).toBeInTheDocument();
  });

  it("shows the rotation row's own snapshot, with its format resolved to a name", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    const summary = await screen.findByRole("table", { name: "Rotation Release" });
    expect(within(summary).getByText("Chuquimamani-Condori")).toBeInTheDocument();
    expect(within(summary).getByText("Edits")).toBeInTheDocument();
    expect(within(summary).getByText("self-released")).toBeInTheDocument();
    expect(within(summary).getByText("CD")).toBeInTheDocument();
    expect(within(summary).getByText("Light")).toBeInTheDocument();
    expect(within(summary).getByText("01/10/26")).toBeInTheDocument();
    expect(within(summary).getByText("02/01/26")).toBeInTheDocument();
  });

  it("reports an outage instead of an empty summary", async () => {
    server.use(
      http.get(
        `${LIBRARY}/rotation/:id`,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(screen.queryByRole("table", { name: "Rotation Release" })).not.toBeInTheDocument();
  });

  it("says so when the rotation release is not in the queue", async () => {
    server.use(
      http.get(`${LIBRARY}/rotation/:id`, () =>
        HttpResponse.json({ message: "Rotation entry not found" }, { status: 404 }),
      ),
    );
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer in the queue/i);
  });

  it("refuses a row that has already been catalogued", async () => {
    mockRotationRow({ ...ROTATION_ROW, album_id: 42 });
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/already been catalogued/i);
    expect(screen.queryByRole("table", { name: "Rotation Release" })).not.toBeInTheDocument();
  });
});

describe("classic RotationImportScreen — the match branch", () => {
  it("lists the library's matching artists with genre, code and Select", async () => {
    mockMatches([MATCH, { ...MATCH, genre_id: 11, genre_name: "Rock", code_number: 4 }]);
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(
      await screen.findByText(/Matching artists in the library for/),
    ).toBeInTheDocument();
    expect(screen.getByText("Electronic CHU 12/")).toBeInTheDocument();
    expect(screen.getByText("Rock CHU 4/")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Select: / })).toHaveLength(2);
    expect(screen.getByText(/Not the right artist\?/)).toBeInTheDocument();
  });

  it("asks for the widest window the search will open", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${LIBRARY}/artists/search`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ artists: [] });
      }),
    );
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await waitFor(() => expect(requested?.searchParams.get("limit")).toBe("20"));
    expect(requested?.searchParams.get("q")).toBe("Chuquimamani-Condori");
    expect(requested?.searchParams.has("genre_id")).toBe(false);
  });

  it("says there are no matches rather than showing an empty table", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);
    expect(await screen.findByText(/No matching artists found for/)).toBeInTheDocument();
  });

  // A failed search rendered as "no matches" is what routes a librarian into
  // creating the duplicate the search exists to prevent.
  it("never renders a failed search as no matches", async () => {
    server.use(
      http.get(
        `${LIBRARY}/artists/search`,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByText(/Artist search is unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/No matching artists found for/)).not.toBeInTheDocument();
  });

  it("auto-selects a lone match, and lets the librarian back out of it", async () => {
    mockMatches([MATCH]);
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByText(/Adding to: Electronic CHU 12\/ — Chuquimamani-Condori/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose a different artist" }));
    expect(await screen.findByText(/Matching artists in the library for/)).toBeInTheDocument();
  });
});

describe("classic RotationImportScreen — rotationReleaseImportNewArtist.jsp", () => {
  // Xerox assertion: the JSP's New Artist section, then its Release section,
  // in its own field order, under its own button label.
  it("renders the new-artist form's field order and button label", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/No matching artists found for/);
    const form = document.forms.namedItem("importToLibraryNewArtist") as HTMLFormElement;
    const labels = Array.from(form.querySelectorAll("td.redlabel, td.label")).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(labels).toEqual([
      "Genre:",
      "Call Letters:",
      "Call Numbers:",
      "Presentation Name:",
      "Alphabetical Name:",
      "Release Call Number:",
      "Title:",
      "Format:",
      "Label:",
      "Alternate Artist Name:",
    ]);
    expect(within(form).getByText("New Artist")).toBeInTheDocument();
    expect(within(form).getByText("Release")).toBeInTheDocument();
    expect(
      within(form).getByRole("button", { name: "Create Artist and Import to Library" }),
    ).toBeInTheDocument();
  });

  it("seeds the artist names and the call letters, with the advisory that they are a guess", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByLabelText("Presentation Name:")).toHaveValue("Chuquimamani-Condori");
    expect(screen.getByLabelText("Alphabetical Name:")).toHaveValue("Chuquimamani-Condori");
    expect(screen.getByLabelText("Call Letters:")).toHaveValue("ch");
    expect(screen.getByText(/^Suggested from the artist's presentation name/)).toBeInTheDocument();
  });

  it("suggests the compilation bucket's letters for a Various Artists row", async () => {
    mockRotationRow({ ...ROTATION_ROW, artist_name: "Various Artists" });
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByLabelText("Call Letters:")).toHaveValue("Z-");
  });

  it("opens the genre select unchosen — the JSP seeds it from flags this row has no column for", async () => {
    renderWithProviders(<RotationImportScreen rotationId={6002} />);
    expect(await screen.findByLabelText("Genre:")).toHaveValue("");
  });
});

describe("classic RotationImportScreen — rotationReleaseImport.jsp's release form", () => {
  // Xerox assertion: the artist-selected branch's own field order and button.
  it("renders the release form's field order and button label", async () => {
    mockMatches([MATCH]);
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/Adding to:/);
    const form = document.forms.namedItem("importToLibrary") as HTMLFormElement;
    const labels = Array.from(form.querySelectorAll("td.redlabel, td.label")).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(labels).toEqual([
      "Library Code:",
      "Title:",
      "Format:",
      "Label:",
      "Alternate Artist Name:",
    ]);
    expect(within(form).getByRole("button", { name: "Import to Library" })).toBeInTheDocument();
  });

  it("seeds the title from the rotation row and the format from its own format_id", async () => {
    mockMatches([MATCH]);
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByLabelText("Title:")).toHaveValue("Edits");
    expect(screen.getByLabelText("Format:")).toHaveValue("3");
  });

  it("leaves the format unchosen for a row that never captured one", async () => {
    mockRotationRow({ ...ROTATION_ROW, format_id: null });
    mockMatches([MATCH]);
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    expect(await screen.findByLabelText("Format:")).toHaveValue("");
  });

  it("pre-fills the next free call number from the artist's own shelf", async () => {
    mockMatches([MATCH]);
    mockReleases([{ id: 1, code_number: 3 }, { id: 2, code_number: 7 }]);
    renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await waitFor(() => expect(screen.getByLabelText("Library Code:")).toHaveValue("8"));
  });

  // D2: re-using a lost record's slot is a deliberate move a single librarian
  // makes, so the advisory states what it knows and does not refuse.
  it("advises without blocking when the typed number is already on the shelf", async () => {
    mockMatches([MATCH]);
    mockReleases([{ id: 1, code_number: 3 }]);
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    const code = await screen.findByLabelText("Library Code:");
    await user.clear(code);
    await user.type(code, "3");

    expect(await screen.findByRole("status")).toHaveTextContent(/already in use/i);
    expect(screen.getByRole("button", { name: "Import to Library" })).toBeEnabled();
  });
});

describe("classic RotationImportScreen — the existing-artist submit chain", () => {
  function mockWrites(overrides: { link?: Response } = {}) {
    const seen: { album?: Record<string, unknown>; link?: Record<string, unknown> } = {};
    server.use(
      http.post(`${LIBRARY}/`, async ({ request }) => {
        seen.album = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 8801, code_number: 8 }, { status: 201 });
      }),
      http.patch(`${LIBRARY}/rotation/:rotationId/link`, async ({ request }) => {
        seen.link = (await request.json()) as Record<string, unknown>;
        return overrides.link ?? HttpResponse.json({ ...ROTATION_ROW, album_id: 8801 });
      }),
    );
    return seen;
  }

  it("creates the release and links the rotation row, then lands on the artist card", async () => {
    mockMatches([MATCH]);
    const seen = mockWrites();
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/Adding to:/);
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    await waitFor(() => expect(seen.link).toEqual({ album_id: 8801 }));
    expect(seen.album).toMatchObject({
      artist_id: 771,
      album_title: "Edits",
      genre_id: 5,
      format_id: 3,
      code_number: 1,
      label: "self-released",
    });
    expect(mockPush).toHaveBeenCalledWith("/dashboard/library/artist/771?imported=6002&code=8");
  });

  // The rotation row's own label id is the normalized one; re-sending its
  // text would leave the release's label unresolved all over again.
  it("carries the rotation row's label_id silently and asks for no label", async () => {
    mockRotationRow({ ...ROTATION_ROW, label_id: 17 });
    mockMatches([MATCH]);
    const seen = mockWrites();
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/Adding to:/);
    expect(screen.queryByLabelText("Record Label")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    await waitFor(() => expect(seen.album).toBeDefined());
    expect(seen.album?.label_id).toBe(17);
    expect("label" in (seen.album ?? {})).toBe(false);
  });

  // `record_label` is the rotation-add endpoint's field name and would 400
  // here; the free-text path sends `label`, with no id invented for it.
  it("submits typed label text as `label`, never as `record_label` or a null id", async () => {
    mockMatches([MATCH]);
    const seen = mockWrites();
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/Adding to:/);
    const labelField = screen.getByLabelText("Record Label");
    await user.clear(labelField);
    await user.type(labelField, "Sonamos");
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    await waitFor(() => expect(seen.album).toBeDefined());
    expect(seen.album?.label).toBe("Sonamos");
    expect("label_id" in (seen.album ?? {})).toBe(false);
    expect("record_label" in (seen.album ?? {})).toBe(false);
  });

  // Backend guards both optional FKs with `!= null`, so an explicit null
  // reads as absent rather than as "clear this". All three states are
  // distinct on the wire and the form must never send the middle one.
  it("never sends format_id or label_id as null — an unchosen format is refused instead", async () => {
    mockRotationRow({ ...ROTATION_ROW, format_id: null });
    mockMatches([MATCH]);
    const seen = mockWrites();
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/Adding to:/);
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    expect(await screen.findByText("Please select a format.")).toBeInTheDocument();
    expect(seen.album).toBeUndefined();

    await user.selectOptions(screen.getByLabelText("Format:"), "4");
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    await waitFor(() => expect(seen.album).toBeDefined());
    expect(seen.album?.format_id).toBe(4);
    expect(seen.album?.label_id).toBeUndefined();
    expect(seen.album?.label).toBe("self-released");
  });

  it("refuses before creating anything when the row was catalogued while the form was open", async () => {
    mockMatches([MATCH]);
    const seen = mockWrites();
    let reads = 0;
    server.use(
      http.get(`${LIBRARY}/rotation/:id`, () => {
        reads += 1;
        return HttpResponse.json(reads === 1 ? ROTATION_ROW : { ...ROTATION_ROW, album_id: 42 });
      }),
    );

    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);
    await screen.findByText(/Adding to:/);
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    expect(await screen.findByText(/catalogued while this form was open/i)).toBeInTheDocument();
    expect(seen.album).toBeUndefined();
    expect(screen.getByLabelText("Title:")).toHaveValue("Edits");
  });

  it("hands a failed link to the created-not-linked screen, which warns against resubmitting", async () => {
    mockMatches([MATCH]);
    mockWrites({ link: new HttpResponse(null, { status: 503 }) });
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/Adding to:/);
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    expect(
      await screen.findByText(/The library release was created, but the rotation release was not linked/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Do not submit the import form again/i)).toBeInTheDocument();
  });

  it("hands an already-linked refusal to the backstop instead of offering a retry", async () => {
    mockMatches([MATCH]);
    mockWrites({
      link: HttpResponse.json(
        { message: "Rotation entry is already linked to a library release" },
        { status: 409 },
      ),
    });
    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);

    await screen.findByText(/Adding to:/);
    await user.click(screen.getByRole("button", { name: "Import to Library" }));

    expect(
      await screen.findByText(/This rotation release was linked while you were cataloging it/),
    ).toBeInTheDocument();
  });
});

describe("classic RotationImportScreen — the new-artist submit chain", () => {
  async function fillNewArtist(user: ReturnType<typeof renderWithProviders>["user"]) {
    await screen.findByText(/No matching artists found for/);
    await user.selectOptions(screen.getByLabelText("Genre:"), "5");
    await user.type(screen.getByLabelText("Call Numbers:"), "12");
  }

  it("creates the artist, then the release under it, then links", async () => {
    const seen: Record<string, unknown> = {};
    server.use(
      http.post(`${LIBRARY}/artists`, async ({ request }) => {
        seen.artist = await request.json();
        return HttpResponse.json({ id: 771, code_letters: "ch" }, { status: 201 });
      }),
      http.post(`${LIBRARY}/`, async ({ request }) => {
        seen.album = await request.json();
        return HttpResponse.json({ id: 8801, code_number: 1 }, { status: 201 });
      }),
      http.patch(`${LIBRARY}/rotation/:rotationId/link`, () =>
        HttpResponse.json({ ...ROTATION_ROW, album_id: 8801 }),
      ),
    );

    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);
    await fillNewArtist(user);
    await user.click(screen.getByRole("button", { name: "Create Artist and Import to Library" }));

    await waitFor(() => expect(seen.album).toBeDefined());
    expect(seen.artist).toEqual({
      artist_name: "Chuquimamani-Condori",
      alphabetical_name: "Chuquimamani-Condori",
      code_letters: "ch",
      genre_id: 5,
      code_number: 12,
    });
    expect(seen.album).toMatchObject({ artist_id: 771, genre_id: 5, album_title: "Edits" });
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/library/artist/771?imported=6002&code=1"),
    );
  });

  // The middle failure: the artist is on record and the release is not, so
  // the message has to say which half stands rather than "failed".
  it("names the artist it already created when the release create fails", async () => {
    server.use(
      http.post(`${LIBRARY}/artists`, () => HttpResponse.json({ id: 771 }, { status: 201 })),
      http.post(`${LIBRARY}/`, () =>
        HttpResponse.json({ message: "Missing Parameters: format_id" }, { status: 400 }),
      ),
    );

    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);
    await fillNewArtist(user);
    await user.click(screen.getByRole("button", { name: "Create Artist and Import to Library" }));

    expect(
      await screen.findByText(/The library code was created, but the release was not/),
    ).toBeInTheDocument();
    expect(screen.getByText(/do not create the artist again/i)).toBeInTheDocument();
  });

  // The artist-name conflict and the taken-code conflict share a status and
  // call for different remedies.
  it("tells the artist step's two 409s apart", async () => {
    server.use(
      http.post(`${LIBRARY}/artists`, () =>
        HttpResponse.json(
          {
            reason: "artist_name_conflict",
            artist: { artist_id: 5, artist_name: "Chuquimamani-Condori", code_letters: "CHU" },
          },
          { status: 409 },
        ),
      ),
    );

    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);
    await fillNewArtist(user);
    await user.click(screen.getByRole("button", { name: "Create Artist and Import to Library" }));

    expect(await screen.findByText(/already exists in this genre/i)).toBeInTheDocument();
  });

  it("refuses a new-artist submit with no genre before anything is created", async () => {
    let posted = false;
    server.use(
      http.post(`${LIBRARY}/artists`, () => {
        posted = true;
        return HttpResponse.json({ id: 771 }, { status: 201 });
      }),
    );

    const { user } = renderWithProviders(<RotationImportScreen rotationId={6002} />);
    await screen.findByText(/No matching artists found for/);
    await user.click(screen.getByRole("button", { name: "Create Artist and Import to Library" }));

    expect(await screen.findByText("You must select a genre.")).toBeInTheDocument();
    expect(posted).toBe(false);
  });
});
