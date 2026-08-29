import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

const mockGetInformationQuery = vi.fn();
const mockUpdateAlbum = vi.fn();
const mockResolveArtistByCode = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetInformationQuery: (...args: unknown[]) => mockGetInformationQuery(...args),
    useGetGenresQuery: () => ({
      data: [
        { id: 1, genre_name: "Rock" },
        { id: 5, genre_name: "Electronic" },
      ],
      isFetching: false,
      refetch: vi.fn(),
    }),
    useGetFormatsQuery: () => ({
      data: [
        { id: 1, format_name: "cd" },
        { id: 2, format_name: "lp" },
      ],
    }),
    useUpdateAlbumMutation: () => [mockUpdateAlbum, { isLoading: false }],
    useLazyResolveArtistByCodeQuery: () => [mockResolveArtistByCode, { isFetching: false }],
  };
});

import ReleaseMoveForm from "@/src/components/experiences/classic/catalog/ReleaseMoveForm";

const album = (overrides = {}) =>
  createTestAlbum({
    id: 53375,
    title: "Tri Repetae",
    entry: 1,
    format: "cd",
    format_id: 1,
    genre_id: 5,
    alternate_artist: "Autechre",
    artist: createTestArtist({
      id: 4211,
      name: "Autechre",
      lettercode: "AU",
      numbercode: 3,
      genre: "Electronic",
    }),
    ...overrides,
  });

const owner = (overrides = {}) => ({
  id: 8802,
  artist_name: "Gescom",
  code_letters: "GE",
  code_number: 7,
  genre_id: 5,
  ...overrides,
});

const resolvesTo = (...artists: ReturnType<typeof owner>[]) =>
  mockResolveArtistByCode.mockReturnValue({ unwrap: () => Promise.resolve({ artists }) });

const rejectsWith = (error: unknown) =>
  mockResolveArtistByCode.mockReturnValue({ unwrap: () => Promise.reject(error) });

const byCodeError = (status: number, data: unknown) => ({
  resolveArtistByCodeError: { status, data },
});

const loaded = (overrides = {}) =>
  mockGetInformationQuery.mockReturnValue({
    data: album(overrides),
    isLoading: false,
    isError: false,
  });

/** Fills the destination picker with a fully specified code and looks it up. */
const lookUpCode = async (letters = "GE", numbers = "7", genre = "Electronic") => {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Genre:"), genre);
  await user.click(screen.getByLabelText("Call letters: mode"));
  await user.type(screen.getByLabelText("Call letters:"), letters);
  await user.type(screen.getByLabelText("Call Numbers:"), numbers);
  await user.click(screen.getByRole("button", { name: "Look up this code" }));
  return user;
};

const submit = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByDisplayValue("Modify this Library Release"));

describe("Classic ReleaseMoveForm — libraryReleaseModifyLibCode.jsp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateAlbum.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  it("reproduces the JSP's heading and its row labels, in order", () => {
    loaded();

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);

    expect(screen.getByText("View/Modify a Library Release")).toBeDefined();
    const labels = screen
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent?.trim())
      .filter((text): text is string => !!text && text.endsWith(":"));
    expect(labels).toEqual([
      "Entire Code For Library Release:",
      "Artist:",
      "Library Code:",
      "Release Call Number:",
      "Release Call Letter:",
      "Alternate Artist Name:",
      "Title of Release:",
      "Format:",
      "Date Added:",
    ]);
  });

  it("shows the code the release is filed under now", () => {
    loaded();

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);

    expect(screen.getByTestId("release-move-current-code").textContent).toBe("Electronic AU 3/1");
  });

  it("refuses to submit a move with no destination resolved", async () => {
    const user = userEvent.setup();
    loaded();

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);
    await submit(user);

    expect(mockUpdateAlbum).not.toHaveBeenCalled();
    expect(screen.getByTestId("release-move-message").textContent).toContain(
      "Look up a library code",
    );
  });

  it("sends the destination genre with the destination artist", async () => {
    loaded();
    resolvesTo(owner({ id: 8802, genre_id: 5 }));

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);
    const user = await lookUpCode();
    await screen.findByTestId("release-move-destination");
    await submit(user);

    // Backend validates the *effective* (artist, genre) pair. Sending
    // artist_id alone leaves the release's current genre in force, so a move
    // across genres is rejected as "Artist is not catalogued in the selected
    // genre" — a 400 for a move the librarian spelled out correctly.
    expect(mockUpdateAlbum).toHaveBeenCalledWith({
      albumId: 53375,
      body: expect.objectContaining({ artist_id: 8802, genre_id: 5 }),
    });
  });

  it("sends the destination genre even when it differs from the release's current one", async () => {
    loaded({ genre_id: 5 });
    resolvesTo(owner({ id: 9001, genre_id: 1, code_letters: "SO", code_number: 2 }));

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);
    const user = await lookUpCode("SO", "2", "Rock");
    await screen.findByTestId("release-move-destination");
    await submit(user);

    expect(mockUpdateAlbum).toHaveBeenCalledWith({
      albumId: 53375,
      body: expect.objectContaining({ artist_id: 9001, genre_id: 1 }),
    });
  });

  it("carries the editable fields through the same submit the JSP does", async () => {
    loaded();
    resolvesTo(owner());

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);
    const user = await lookUpCode();
    await screen.findByTestId("release-move-destination");
    const title = screen.getByLabelText("Title of Release");
    await user.clear(title);
    await user.type(title, "Tri Repetae++");
    await submit(user);

    expect(mockUpdateAlbum).toHaveBeenCalledWith({
      albumId: 53375,
      body: expect.objectContaining({ album_title: "Tri Repetae++", format_id: 1 }),
    });
  });

  it("never sends a call number or call letter, which the endpoint cannot write", async () => {
    loaded();
    resolvesTo(owner());

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);
    const user = await lookUpCode();
    await screen.findByTestId("release-move-destination");
    await submit(user);

    const body = mockUpdateAlbum.mock.calls[0][0].body;
    expect(body).not.toHaveProperty("code_number");
    expect(body).not.toHaveProperty("code_letters");
  });

  it("names the destination before the move, so the librarian sees where it lands", async () => {
    loaded();
    resolvesTo(owner({ artist_name: "Gescom" }));

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);
    await lookUpCode();

    expect((await screen.findByTestId("release-move-destination")).textContent).toContain("Gescom");
  });

  it("looks up the genre's compilation shelf from the Various Artists radio, with no code typed", async () => {
    const user = userEvent.setup();
    loaded();
    resolvesTo(owner({ id: 7000, artist_name: "Warp 10th Anniversary" }));

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);
    await user.selectOptions(screen.getByLabelText("Genre:"), "Electronic");
    await user.click(screen.getByLabelText("Various Artists (compilations)"));
    await user.click(screen.getByRole("button", { name: "Look up this code" }));

    // Every V/A bucket in a genre is filed at the one fixed pair, so the radio
    // needs no letters or numbers from the librarian to address the shelf.
    expect(mockResolveArtistByCode).toHaveBeenCalledWith({
      genre_id: 5,
      code_letters: "V/A",
      code_number: 0,
    });
  });

  describe("a code more than one artist owns", () => {
    it("lists the owners rather than picking one", async () => {
      loaded();
      resolvesTo(
        owner({ id: 1, artist_name: "Mille Plateaux Sampler" }),
        owner({ id: 2, artist_name: "Warp 10th Anniversary" }),
      );

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      await lookUpCode("V/A", "0");

      expect(await screen.findByTestId("release-move-owners")).toBeDefined();
      expect(screen.getByRole("radio", { name: "Mille Plateaux Sampler" })).toBeDefined();
      expect(screen.getByRole("radio", { name: "Warp 10th Anniversary" })).toBeDefined();
    });

    it("refuses the move until one of them is chosen", async () => {
      loaded();
      resolvesTo(owner({ id: 1, artist_name: "One" }), owner({ id: 2, artist_name: "Two" }));

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      const user = await lookUpCode("V/A", "0");
      await screen.findByTestId("release-move-owners");
      await submit(user);

      expect(mockUpdateAlbum).not.toHaveBeenCalled();
    });

    it("moves to the chosen owner once one is picked", async () => {
      loaded();
      resolvesTo(owner({ id: 1, artist_name: "One" }), owner({ id: 2, artist_name: "Two" }));

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      const user = await lookUpCode("V/A", "0");
      await screen.findByTestId("release-move-owners");
      await user.click(screen.getByRole("radio", { name: "Two" }));
      await submit(user);

      expect(mockUpdateAlbum).toHaveBeenCalledWith({
        albumId: 53375,
        body: expect.objectContaining({ artist_id: 2 }),
      });
    });
  });

  describe("a destination the lookup cannot confirm", () => {
    it("says an unassigned code has nobody to move the release to", async () => {
      loaded();
      rejectsWith(byCodeError(404, { reason: "code_not_assigned" }));

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      await lookUpCode("ZZ", "9");

      expect((await screen.findByTestId("release-move-message")).textContent).toContain(
        "No artist is filed under that code",
      );
      expect(screen.queryByTestId("release-move-destination")).toBeNull();
    });

    it("refuses an unreadable answer instead of reading it as an empty code", async () => {
      loaded();
      rejectsWith(byCodeError(500, { message: "boom" }));

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      await lookUpCode();

      // The one answer an outage must not give: treating it as "code not
      // assigned" here would tell the librarian a populated code is empty.
      expect((await screen.findByTestId("release-move-message")).textContent).not.toContain(
        "No artist is filed under that code",
      );
      expect(screen.queryByTestId("release-move-destination")).toBeNull();
    });

    it("refuses a 200 carrying no owners, a shape the endpoint never legitimately sends", async () => {
      loaded();
      resolvesTo();

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      const user = await lookUpCode();
      await submit(user);

      expect(mockUpdateAlbum).not.toHaveBeenCalled();
      expect(screen.queryByTestId("release-move-destination")).toBeNull();
    });

    it("will not move a release onto the code it is already filed under", async () => {
      loaded();
      resolvesTo(owner({ id: 4211, artist_name: "Autechre", code_letters: "AU", code_number: 3 }));

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      const user = await lookUpCode("AU", "3");
      await screen.findByTestId("release-move-destination");
      await submit(user);

      expect(mockUpdateAlbum).not.toHaveBeenCalled();
      expect(screen.getByTestId("release-move-message").textContent).toContain("already filed");
    });
  });

  describe("after the move", () => {
    it("reports it, and says the call number may have moved with it", async () => {
      loaded();
      resolvesTo(owner());

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      const user = await lookUpCode();
      await screen.findByTestId("release-move-destination");
      await submit(user);

      const message = (await screen.findByTestId("release-move-message")).textContent ?? "";
      expect(message).toContain("moved");
      // Backend keeps the release's code number unless the destination artist
      // already owns it, in which case it burns the next one — so the number
      // on screen before the move is not a promise.
      expect(message).toContain("call number");
    });

    it("reports a refused move rather than a success", async () => {
      loaded();
      resolvesTo(owner());
      mockUpdateAlbum.mockReturnValue({
        unwrap: () =>
          Promise.reject({ status: 400, data: { message: "Artist is not catalogued in the selected genre" } }),
      });

      renderWithProviders(<ReleaseMoveForm albumId={53375} />);
      const user = await lookUpCode();
      await screen.findByTestId("release-move-destination");
      await submit(user);

      const message = (await screen.findByTestId("release-move-message")).textContent ?? "";
      expect(message).toContain("could not be moved");
      expect(message).not.toContain("has been moved");
    });
  });

  it("surfaces a load failure rather than offering a move for a release it never read", () => {
    mockGetInformationQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderWithProviders(<ReleaseMoveForm albumId={53375} />);

    expect(screen.getByTestId("release-move-error")).toBeDefined();
    expect(screen.queryByDisplayValue("Modify this Library Release")).toBeNull();
  });
});
