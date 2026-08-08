import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import type { ArtistInGenreOption } from "@/lib/features/catalog/types";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// No organization configured (the real production shape): the WXYC tier
// resolves via fetchOrganizationRoleForUserClient's JWT decode, not the raw
// session role, so every test drives that mock and awaits resolution.
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));

vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn(),
}));

import { authClient } from "@/lib/features/authentication/client";
import { fetchOrganizationRoleForUserClient } from "@/lib/features/authentication/organization-utils";

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>;
const mockFetchOrgRole = fetchOrganizationRoleForUserClient as ReturnType<
  typeof vi.fn
>;

function sessionWithRole() {
  return {
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
  };
}

const ARTIST_SEARCH_URL = `${TEST_BACKEND_URL}/library/artists/search`;

const ROCK_GENRE_ID = 7;
const JAZZ_GENRE_ID = 99;

const juanaMolina: ArtistInGenreOption = {
  id: 12,
  artist_name: "Juana Molina",
  code_letters: "MO",
  code_number: 3,
};

const chuquimamaniCondori: ArtistInGenreOption = {
  id: 20,
  artist_name: "Chuquimamani-Condori",
  code_letters: "CH",
  code_number: 1,
};

const jessicaPratt: ArtistInGenreOption = {
  id: 31,
  artist_name: "Jessica Pratt",
  code_letters: "PR",
  code_number: 5,
};

const stereolab: ArtistInGenreOption = {
  id: 44,
  artist_name: "Stereolab",
  code_letters: "ST",
  code_number: 2,
};

const niluferYanya: ArtistInGenreOption = {
  id: 57,
  artist_name: "Nilüfer Yanya",
  code_letters: "YA",
  code_number: 4,
};

type SearchResponder = (url: URL) => Response | Promise<Response>;

/**
 * Installs the artist-search handler and returns the list of requests it has
 * served. Every request is appended, so a test can assert how many the
 * component actually issued — a single last-write-wins capture cannot tell one
 * debounced request from five.
 */
function mockArtistSearch(
  respond: ArtistInGenreOption[] | SearchResponder,
): URL[] {
  const requests: URL[] = [];
  server.use(
    http.get(ARTIST_SEARCH_URL, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return typeof respond === "function"
        ? respond(url)
        : HttpResponse.json({ artists: respond });
    }),
  );
  return requests;
}

/**
 * The component's search text is caller-owned, so tests drive it through a
 * host that holds the value — the same shape the consuming forms use.
 */
function ControlledTypeahead({
  genreId = ROCK_GENRE_ID,
  initialValue = "",
  onSelect = vi.fn(),
  onCreateNew = vi.fn(),
  onSelectionCleared = vi.fn(),
  disabled,
}: {
  genreId?: number;
  initialValue?: string;
  onSelect?: (artist: ArtistInGenreOption) => void;
  onCreateNew?: (searchTerm: string) => void;
  onSelectionCleared?: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ArtistSearchTypeahead
      genreId={genreId}
      value={value}
      onChange={setValue}
      onSelect={onSelect}
      onCreateNew={onCreateNew}
      onSelectionCleared={onSelectionCleared}
      disabled={disabled}
    />
  );
}

const findInput = () => screen.findByPlaceholderText("Search artists...");

describe("ArtistSearchTypeahead", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("permission gating", () => {
    it("renders nothing for a DJ", async () => {
      mockFetchOrgRole.mockResolvedValue("dj");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<ControlledTypeahead />);

      await waitFor(() => expect(mockFetchOrgRole).toHaveBeenCalled());
      await mockFetchOrgRole.mock.results[0].value;
      await waitFor(() =>
        expect(
          screen.queryByPlaceholderText("Search artists..."),
        ).not.toBeInTheDocument(),
      );
    });

    it("renders the search input for a Music Director", async () => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
      renderWithProviders(<ControlledTypeahead />);

      expect(await findInput()).toBeInTheDocument();
    });
  });

  describe("as a Music Director", () => {
    beforeEach(() => {
      mockFetchOrgRole.mockResolvedValue("musicDirector");
      mockUseSession.mockReturnValue(sessionWithRole());
    });

    describe("querying", () => {
      it("issues one debounced request scoped to the given genre", async () => {
        const requests = mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");

        expect(requests).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(400);
        await waitFor(() => expect(requests).toHaveLength(1));

        expect(requests[0].searchParams.get("q")).toBe("Juana");
        expect(requests[0].searchParams.get("genre_id")).toBe(
          String(ROCK_GENRE_ID),
        );
      });

      it("does not query below the minimum query length", async () => {
        const requests = mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "J");
        await vi.advanceTimersByTimeAsync(400);

        expect(requests).toHaveLength(0);
      });

      it("does not query for a seeded value until the panel is opened", async () => {
        const requests = mockArtistSearch([juanaMolina]);
        renderWithProviders(<ControlledTypeahead initialValue="Juana Molina" />);

        await findInput();
        await vi.advanceTimersByTimeAsync(400);

        expect(requests).toHaveLength(0);
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      it("renders matching results", async () => {
        mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);

        expect(await screen.findByText("Juana Molina")).toBeInTheDocument();
      });
    });

    describe("stale results", () => {
      it("drops the previous genre's results when the genre changes", async () => {
        const requests = mockArtistSearch((url) =>
          HttpResponse.json({
            artists:
              url.searchParams.get("genre_id") === String(ROCK_GENRE_ID)
                ? [juanaMolina]
                : [jessicaPratt],
          }),
        );
        const { user, rerender } = renderWithProviders(
          <ControlledTypeahead genreId={ROCK_GENRE_ID} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        expect(await screen.findByText("Juana Molina")).toBeInTheDocument();

        rerender(<ControlledTypeahead genreId={JAZZ_GENRE_ID} />);
        await vi.advanceTimersByTimeAsync(400);

        await waitFor(() =>
          expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument(),
        );
        expect(
          requests.some(
            (r) => r.searchParams.get("genre_id") === String(JAZZ_GENRE_ID),
          ),
        ).toBe(true);
      });

      it("drops the previous genre's results while the new genre's request is still open", async () => {
        let releaseJazz = () => {};
        const jazzHeld = new Promise<void>((resolve) => {
          releaseJazz = resolve;
        });
        mockArtistSearch(async (url) => {
          if (url.searchParams.get("genre_id") === String(JAZZ_GENRE_ID)) {
            await jazzHeld;
            return HttpResponse.json({ artists: [niluferYanya] });
          }
          return HttpResponse.json({ artists: [juanaMolina] });
        });
        const { user, rerender } = renderWithProviders(
          <ControlledTypeahead genreId={ROCK_GENRE_ID} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        expect(await screen.findByText("Juana Molina")).toBeInTheDocument();

        rerender(<ControlledTypeahead genreId={JAZZ_GENRE_ID} />);

        // The genre-7 answer is not an answer about genre 99, so it must be
        // gone for the whole window in which the genre-99 request is open —
        // not merely once that request settles. A row still standing here is
        // selectable, and the caller would file it under the wrong genre.
        expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(screen.queryByText(/Create new artist/i)).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
          /Searching artists/i,
        );

        releaseJazz();
        expect(await screen.findByText("Nilüfer Yanya")).toBeInTheDocument();
      });

      it("keeps the highlight on a real row when the result set shrinks", async () => {
        const onSelect = vi.fn();
        const onCreateNew = vi.fn();
        mockArtistSearch((url) =>
          HttpResponse.json({
            artists:
              url.searchParams.get("genre_id") === String(ROCK_GENRE_ID)
                ? [juanaMolina, chuquimamaniCondori, jessicaPratt, stereolab]
                : [niluferYanya, stereolab],
          }),
        );
        const { user, rerender } = renderWithProviders(
          <ControlledTypeahead
            genreId={ROCK_GENRE_ID}
            onSelect={onSelect}
            onCreateNew={onCreateNew}
          />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Jessica Pratt");

        // Third result of four.
        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

        rerender(
          <ControlledTypeahead
            genreId={JAZZ_GENRE_ID}
            onSelect={onSelect}
            onCreateNew={onCreateNew}
          />,
        );
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Nilüfer Yanya");
        await waitFor(() =>
          expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument(),
        );

        // Two results now: the index the highlight held no longer exists, and
        // the row that moved into its place is "create new". Enter must land on
        // the last real result rather than silently creating an artist.
        await user.keyboard("{Enter}");

        expect(onSelect).toHaveBeenCalledWith(stereolab);
        expect(onCreateNew).not.toHaveBeenCalled();
      });

      it("drops results as soon as the query falls below the minimum length", async () => {
        mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        expect(await screen.findByText("Juana Molina")).toBeInTheDocument();

        await user.clear(input);

        expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument();
      });

      it("drops results while a newly typed query is still debouncing", async () => {
        mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        expect(await screen.findByText("Juana Molina")).toBeInTheDocument();

        // Still a valid query, but no longer the one that produced these rows.
        await user.type(input, "s");

        expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument();
      });
    });

    describe("selection", () => {
      it("calls onSelect with the full artist object on click", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelect = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelect={onSelect} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);

        await user.click(await screen.findByText("Juana Molina"));

        expect(onSelect).toHaveBeenCalledWith(juanaMolina);
        expect(input).toHaveValue("Juana Molina");
      });

      it("writes the picked name into the field before reporting the selection", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelect = vi.fn();

        // A host that rewrites the field from inside `onSelect` — the ordering
        // consumers are told they can rely on. It only holds while the
        // component's own write to `value` lands first; reversed, the component
        // would overwrite the caller and the rewrite would vanish.
        function RewritingHost() {
          const [value, setValue] = useState("");
          return (
            <ArtistSearchTypeahead
              genreId={ROCK_GENRE_ID}
              value={value}
              onChange={setValue}
              onSelect={(artist) => {
                setValue(`${artist.artist_name} (linked)`);
                onSelect(artist);
              }}
              onCreateNew={vi.fn()}
              onSelectionCleared={vi.fn()}
            />
          );
        }

        const { user } = renderWithProviders(<RewritingHost />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Juana Molina"));

        expect(onSelect).toHaveBeenCalledWith(juanaMolina);
        expect(input).toHaveValue("Juana Molina (linked)");
      });

      it("navigates results with the keyboard and selects with Enter", async () => {
        mockArtistSearch([juanaMolina, chuquimamaniCondori]);
        const onSelect = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelect={onSelect} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");

        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");

        expect(onSelect).toHaveBeenCalledWith(juanaMolina);
      });

      it("issues no further request once a result has been picked", async () => {
        const requests = mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);

        await user.click(await screen.findByText("Juana Molina"));
        await vi.advanceTimersByTimeAsync(400);

        expect(requests).toHaveLength(1);
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      it("reopens the panel when the already-focused input is clicked", async () => {
        mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Juana Molina"));

        // The options' onMouseDown preventDefault keeps focus on the input, so
        // clicking it again cannot refire onFocus.
        expect(input).toHaveFocus();
        await user.click(input);
        await vi.advanceTimersByTimeAsync(400);

        expect(await screen.findByRole("listbox")).toBeInTheDocument();
      });

      it("does not act on Enter in a panel opened without navigating", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelect = vi.fn();
        const onCreateNew = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead
            initialValue="Juana Molina"
            onSelect={onSelect}
            onCreateNew={onCreateNew}
          />,
        );

        // A seeded field opened by click, never typed into: nothing has reset
        // the highlight, so this is the only path on which its initial value is
        // what keeps Enter from acting on a row the user never chose.
        const input = await findInput();
        await user.click(input);
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");

        await user.keyboard("{Enter}");

        expect(onSelect).not.toHaveBeenCalled();
        expect(onCreateNew).not.toHaveBeenCalled();
      });

      it("clears the highlight when the panel is closed by clicking away", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelect = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelect={onSelect} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");
        await user.keyboard("{ArrowDown}");

        await user.click(document.body);
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

        await user.click(input);
        await screen.findByRole("listbox");
        await user.keyboard("{Enter}");

        expect(onSelect).not.toHaveBeenCalled();
      });

      it("closes the panel on Escape", async () => {
        mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByRole("listbox");

        await user.keyboard("{Escape}");

        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    describe("retracting a selection", () => {
      it("retracts the picked artist once the text is edited away from it", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelect = vi.fn();
        const onSelectionCleared = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead
            onSelect={onSelect}
            onSelectionCleared={onSelectionCleared}
          />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Juana Molina"));

        expect(onSelect).toHaveBeenCalledWith(juanaMolina);
        expect(onSelectionCleared).not.toHaveBeenCalled();

        // The field now reads something other than the artist the caller was
        // told about, so the id it is holding no longer describes this text.
        await user.type(input, "s");

        expect(onSelectionCleared).toHaveBeenCalledTimes(1);

        // The caller has already dropped the id; further edits are not further
        // retractions.
        await user.type(input, "x");

        expect(onSelectionCleared).toHaveBeenCalledTimes(1);
      });

      it("re-confirms the picked artist once an edit returns the text to its exact name", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelect = vi.fn();
        const onSelectionCleared = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead
            onSelect={onSelect}
            onSelectionCleared={onSelectionCleared}
          />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Juana Molina"));
        expect(onSelect).toHaveBeenCalledTimes(1);

        await user.type(input, "x");
        expect(onSelectionCleared).toHaveBeenCalledTimes(1);

        // The correction lands the field back on byte-identical text — not a
        // new question, since this is the exact artist already confirmed.
        // Nothing else tells a caller holding no id to check again.
        await user.type(input, "{Backspace}");

        expect(onSelect).toHaveBeenCalledTimes(2);
        expect(onSelect).toHaveBeenLastCalledWith(juanaMolina);
        expect(onSelectionCleared).toHaveBeenCalledTimes(1);

        // Confirmed again; a further edit away retracts it a second time.
        await user.type(input, "!");
        expect(onSelectionCleared).toHaveBeenCalledTimes(2);
      });

      it("re-arms the retraction after a second pick", async () => {
        mockArtistSearch([juanaMolina, chuquimamaniCondori]);
        const onSelectionCleared = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelectionCleared={onSelectionCleared} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Juana Molina"));
        await user.type(input, "s");
        expect(onSelectionCleared).toHaveBeenCalledTimes(1);

        await user.clear(input);
        await user.type(input, "Chuqui");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Chuquimamani-Condori"));
        await user.type(input, "s");

        expect(onSelectionCleared).toHaveBeenCalledTimes(2);
      });

      it("retracts the picked artist when the genre moves under it", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelect = vi.fn();
        const onSelectionCleared = vi.fn();
        const { user, rerender } = renderWithProviders(
          <ControlledTypeahead
            genreId={ROCK_GENRE_ID}
            onSelect={onSelect}
            onSelectionCleared={onSelectionCleared}
          />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Juana Molina"));

        expect(onSelect).toHaveBeenCalledWith(juanaMolina);
        expect(onSelectionCleared).not.toHaveBeenCalled();

        // Artist rows are scoped to a genre, so the id the caller is holding
        // names no row once the form files the release under another one. A
        // caller that kept it would save an artist link its own genre does not
        // have.
        rerender(
          <ControlledTypeahead
            genreId={JAZZ_GENRE_ID}
            onSelect={onSelect}
            onSelectionCleared={onSelectionCleared}
          />,
        );

        expect(onSelectionCleared).toHaveBeenCalledTimes(1);

        // The caller has already dropped the id; editing the text afterwards is
        // not a second retraction.
        await user.type(input, "s");

        expect(onSelectionCleared).toHaveBeenCalledTimes(1);
      });

      it("leaves the field text standing when the genre moves under a picked artist", async () => {
        mockArtistSearch([juanaMolina]);
        const { user, rerender } = renderWithProviders(
          <ControlledTypeahead genreId={ROCK_GENRE_ID} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await user.click(await screen.findByText("Juana Molina"));

        rerender(<ControlledTypeahead genreId={JAZZ_GENRE_ID} />);

        // Refiling a release does not rename its artist: the text is exactly
        // what the user needs in order to re-pick that artist under the new
        // genre, and clearing it would leave the form with no artist at all.
        expect(input).toHaveValue("Juana Molina");
      });

      it("reports no retraction when the genre moves with nothing picked", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelectionCleared = vi.fn();
        const { user, rerender } = renderWithProviders(
          <ControlledTypeahead
            genreId={ROCK_GENRE_ID}
            onSelectionCleared={onSelectionCleared}
          />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");

        rerender(
          <ControlledTypeahead
            genreId={JAZZ_GENRE_ID}
            onSelectionCleared={onSelectionCleared}
          />,
        );
        await vi.advanceTimersByTimeAsync(400);

        expect(onSelectionCleared).not.toHaveBeenCalled();
      });

      it("reports no retraction for text that was never a selection", async () => {
        mockArtistSearch([juanaMolina]);
        const onSelectionCleared = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelectionCleared={onSelectionCleared} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");
        await user.type(input, " Molina");
        await user.clear(input);

        expect(onSelectionCleared).not.toHaveBeenCalled();
      });
    });

    describe("creating a new artist", () => {
      it("offers to create a new artist with the current search term", async () => {
        mockArtistSearch([]);
        const onCreateNew = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onCreateNew={onCreateNew} />,
        );

        const input = await findInput();
        await user.type(input, "Nonexistent Band");
        await vi.advanceTimersByTimeAsync(400);

        await user.click(
          await screen.findByText('Create new artist "Nonexistent Band"'),
        );

        expect(onCreateNew).toHaveBeenCalledWith("Nonexistent Band");
      });

      it("reaches the create row with the keyboard past the last result", async () => {
        mockArtistSearch([juanaMolina]);
        const onCreateNew = vi.fn();
        const onSelect = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelect={onSelect} onCreateNew={onCreateNew} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");

        await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

        expect(onCreateNew).toHaveBeenCalledWith("Juana");
        expect(onSelect).not.toHaveBeenCalled();
      });

      it("stays on the create row when arrowing down past it", async () => {
        mockArtistSearch([juanaMolina]);
        const onCreateNew = vi.fn();
        const onSelect = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelect={onSelect} onCreateNew={onCreateNew} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");

        // Result, create row, then one press past the end of the list: create
        // is the last row, so the highlight holds there rather than wrapping
        // off it and stranding the user mid-list.
        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

        expect(onCreateNew).toHaveBeenCalledWith("Juana");
        expect(onSelect).not.toHaveBeenCalled();
      });

      it("returns to the last result when arrowing up off the create row", async () => {
        mockArtistSearch([juanaMolina, chuquimamaniCondori]);
        const onCreateNew = vi.fn();
        const onSelect = vi.fn();
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelect={onSelect} onCreateNew={onCreateNew} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Chuquimamani-Condori");

        // The create row is held as a sentinel rather than as an index one past
        // the last result, so backing out of it has to name the row to return
        // to; the last result is the row directly above it.
        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");

        expect(onSelect).toHaveBeenCalledWith(chuquimamaniCondori);
        expect(onCreateNew).not.toHaveBeenCalled();
      });

      it("names the create row in aria-activedescendant while it is highlighted", async () => {
        mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        const [resultOption, createOption] = await screen.findAllByRole("option");

        await user.keyboard("{ArrowDown}");
        expect(input).toHaveAttribute("aria-activedescendant", resultOption.id);

        // The create row's highlight is a sentinel, not an index into the
        // results, so it needs its own branch to name the option a screen
        // reader should announce.
        await user.keyboard("{ArrowDown}");
        expect(input).toHaveAttribute("aria-activedescendant", createOption.id);
      });

      it("does not create on Enter before results have arrived", async () => {
        const onCreateNew = vi.fn();
        const onSelect = vi.fn();
        mockArtistSearch([juanaMolina]);
        const { user } = renderWithProviders(
          <ControlledTypeahead onSelect={onSelect} onCreateNew={onCreateNew} />,
        );

        const input = await findInput();
        await user.type(input, "Juana");

        // Still inside the debounce window: no row exists to act on.
        await user.keyboard("{Enter}");

        expect(onCreateNew).not.toHaveBeenCalled();
        expect(onSelect).not.toHaveBeenCalled();
      });
    });

    describe("failed search", () => {
      it("reports the failure instead of offering to create a duplicate", async () => {
        mockArtistSearch(() =>
          HttpResponse.json({ message: "boom" }, { status: 500 }),
        );
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);

        expect(await screen.findByRole("alert")).toHaveTextContent(
          /Artist search is unavailable/i,
        );
        expect(
          screen.queryByText(/Create new artist/i),
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      it("reports a failure that follows a successful search", async () => {
        mockArtistSearch((url) =>
          url.searchParams.get("q") === "Juana"
            ? HttpResponse.json({ artists: [juanaMolina] })
            : HttpResponse.json({ message: "boom" }, { status: 500 }),
        );
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");

        await user.clear(input);
        await user.type(input, "Stereolab");
        await vi.advanceTimersByTimeAsync(400);

        // The earlier query's answer must not stand in for this one: reporting
        // it as a match would be a wrong positive, and the create row it comes
        // with would offer duplication on the back of an outage.
        expect(await screen.findByRole("alert")).toHaveTextContent(
          /Artist search is unavailable/i,
        );
        expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument();
        expect(screen.queryByText(/Create new artist/i)).not.toBeInTheDocument();
      });

      it("closes on Escape even though there are no rows to navigate", async () => {
        mockArtistSearch(() =>
          HttpResponse.json({ message: "boom" }, { status: 500 }),
        );
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByRole("alert");

        await user.keyboard("{Escape}");

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });

      it("retries the search on demand", async () => {
        let failNext = true;
        const requests = mockArtistSearch(() => {
          if (failNext) {
            failNext = false;
            return HttpResponse.json({ message: "boom" }, { status: 500 });
          }
          return HttpResponse.json({ artists: [juanaMolina] });
        });
        const { user } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByRole("alert");

        await user.click(screen.getByRole("button", { name: /try again/i }));
        await vi.advanceTimersByTimeAsync(400);

        expect(await screen.findByText("Juana Molina")).toBeInTheDocument();
        expect(requests).toHaveLength(2);
      });
    });

    describe("disabled", () => {
      it("neither opens nor queries", async () => {
        const requests = mockArtistSearch([juanaMolina]);
        renderWithProviders(<ControlledTypeahead initialValue="Juana" disabled />);

        const input = await findInput();
        expect(input).toBeDisabled();

        await vi.advanceTimersByTimeAsync(400);

        expect(requests).toHaveLength(0);
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });

      it("takes down a panel that is already open when the field is disabled", async () => {
        mockArtistSearch([juanaMolina]);
        const { user, rerender } = renderWithProviders(<ControlledTypeahead />);

        const input = await findInput();
        await user.type(input, "Juana");
        await vi.advanceTimersByTimeAsync(400);
        await screen.findByText("Juana Molina");

        rerender(<ControlledTypeahead disabled />);

        // The greyed-out input says the field is inert. A row left standing
        // under it is not: one click hands the caller an artist id it is no
        // longer allowed to accept, with nothing on screen to say so.
        expect(input).toBeDisabled();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(screen.queryAllByRole("option")).toHaveLength(0);
        expect(screen.queryByText("Juana Molina")).not.toBeInTheDocument();
        expect(screen.queryByText(/Create new artist/i)).not.toBeInTheDocument();
      });
    });
  });
});
