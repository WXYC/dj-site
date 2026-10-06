import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/dashboard/library",
}));

import LibraryChooser from "@/src/components/experiences/classic/catalog/LibraryChooser";

const ROCK_GENRE_ID = 11;
const SOUNDTRACKS_GENRE_ID = 12;
const BY_CODE_URL = `${TEST_BACKEND_URL}/library/artists/by-code`;

const bucket = (id: number, genre_id: number, name: string, code_comp_letter: string) => ({
  id,
  artist_name: name,
  code_letters: "V/A",
  code_number: 0,
  genre_id,
  code_comp_letter,
});

// Letters are served (so the catalog is backfilled) but none is the typed "Q".
const served = {
  Rock: [
    bucket(1, ROCK_GENRE_ID, "Various Artists - Rock - A", "A"),
    bucket(2, ROCK_GENRE_ID, "Various Artists - Rock - B", "B"),
  ],
  Soundtracks: [
    bucket(3, SOUNDTRACKS_GENRE_ID, "Soundtracks - A", "A"),
    bucket(4, SOUNDTRACKS_GENRE_ID, "Soundtracks - B", "B"),
  ],
};

// The free-text search above the call-number form carries its own genre select.
const callNumberForm = () => within(document.forms.namedItem("artistSearchForm")!);

describe("classic LibraryChooser — compilation section letter that matches no bucket", () => {
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
        HttpResponse.json([
          { id: ROCK_GENRE_ID, genre_name: "Rock" },
          { id: SOUNDTRACKS_GENRE_ID, genre_name: "Soundtracks" },
        ]),
      ),
    );
  });

  it.each([
    ["Rock", "Rock V/A Q", ROCK_GENRE_ID],
    ["Soundtracks", "Soundtracks Q", SOUNDTRACKS_GENRE_ID],
  ] as const)(
    "names the typed letter in the %s header and returns to the chooser with the inputs kept",
    async (genre, header, genreId) => {
      server.use(
        http.get(BY_CODE_URL, () => HttpResponse.json({ artists: served[genre] })),
      );
      const { user } = renderWithProviders(<LibraryChooser />);
      await callNumberForm().findByRole("option", { name: genre });
      await user.selectOptions(callNumberForm().getByLabelText(/^genre/i), genre);
      await user.click(screen.getByRole("radio", { name: /various artists/i }));
      // Lower-case and padded on purpose: the header echoes the value the
      // narrowing matched against, not the raw keystrokes.
      await user.type(screen.getByLabelText(/rock comp/i), "q");
      await user.click(screen.getByRole("button", { name: "Search!" }));

      const display = await screen.findByTestId("multiple-artists-display");
      expect(display).toHaveTextContent(header);
      expect(display).toHaveTextContent(
        "There are currently no artists in the catalog that match these criteria.",
      );

      await user.click(screen.getByRole("button", { name: "Do another search" }));

      await waitFor(() =>
        expect(callNumberForm().getByLabelText(/^genre/i)).toHaveValue(String(genreId)),
      );
      expect(screen.getByRole("radio", { name: /various artists/i })).toBeChecked();
      expect(screen.getByLabelText(/rock comp/i)).toHaveValue("Q");
    },
  );

  it("leaves a collision list's header and a later return unprefilled", async () => {
    const unfilled = served.Rock.map((b) => ({ ...b, code_comp_letter: null }));
    server.use(http.get(BY_CODE_URL, () => HttpResponse.json({ artists: unfilled })));
    const { user } = renderWithProviders(<LibraryChooser />);
    await callNumberForm().findByRole("option", { name: "Rock" });
    await user.selectOptions(callNumberForm().getByLabelText(/^genre/i), "Rock");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    await user.type(screen.getByLabelText(/rock comp/i), "Q");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    const display = await screen.findByTestId("multiple-artists-display");
    expect(display).toHaveTextContent("Rock V/A");
    expect(display).not.toHaveTextContent("Rock V/A Q");

    await user.click(screen.getByRole("button", { name: "Choose/Add Library Codes" }));

    expect(await screen.findByRole("radio", { name: /various artists/i })).not.toBeChecked();
  });
});
