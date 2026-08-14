import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

import ArtistSearchForm from "@/src/components/experiences/classic/catalog/ArtistSearchForm";

const ROCK_GENRE_ID = 11;
const SOUNDTRACKS_GENRE_ID = 12;
const BLUES_GENRE_ID = 3;

function mockGenres() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([
        { id: BLUES_GENRE_ID, genre_name: "Blues" },
        { id: ROCK_GENRE_ID, genre_name: "Rock" },
        { id: SOUNDTRACKS_GENRE_ID, genre_name: "Soundtracks" },
      ]),
    ),
  );
}

async function selectGenre(user: ReturnType<typeof renderWithProviders>["user"], name: string) {
  await screen.findByRole("option", { name });
  await user.selectOptions(screen.getByLabelText(/^genre/i), name);
}

describe("classic ArtistSearchForm — chooseLibraryCodeOrArtist.jsp's artistSearchForm", () => {
  beforeEach(() => {
    mockGenres();
  });

  it("renders the JSP's copy, radio modes, and button labels", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);

    expect(
      await screen.findByText(/enter a library code below\. if the code exists/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/if the code does not exist, you will get the chance/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Call letters:")).toBeInTheDocument();
    expect(screen.getByLabelText(/call numbers:/i)).toBeInTheDocument();
    expect(screen.getByText(/various artists \(compilations\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset values" })).toBeInTheDocument();

    // The label is reproduced verbatim, including its incompleteness: it
    // names only Rock comps even though the validator also gates genre 12.
    // Only rendered once genre 11/12 is paired with the compilation radio,
    // matching the JSP's own `checkForRockComps()` gating.
    await selectGenre(user, "Rock");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    expect(screen.getByText(/\(rock comps require a call letter\)/i)).toBeInTheDocument();
  });

  it("disables the genre select until genres load, then defaults it to the first genre with no placeholder option", async () => {
    renderWithProviders(<ArtistSearchForm />);

    expect(screen.getByLabelText(/^genre/i)).toBeDisabled();

    await screen.findByRole("option", { name: "Blues" });

    await waitFor(() =>
      expect(screen.getByLabelText(/^genre/i)).toHaveValue(String(BLUES_GENRE_ID)),
    );
    expect(screen.getByLabelText(/^genre/i)).toBeEnabled();
    expect(screen.queryByRole("option", { name: /select genre/i })).not.toBeInTheDocument();
  });

  it("disables the letters/numbers textboxes until the textbox radio is chosen", async () => {
    renderWithProviders(<ArtistSearchForm />);

    expect(screen.getByLabelText("Call letters:")).toBeDisabled();
    expect(screen.getByLabelText(/call numbers:/i)).toBeDisabled();
  });

  it("enables the letters/numbers textboxes once the textbox radio is chosen", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);

    await user.click(screen.getByRole("radio", { name: /call letters:/i }));

    expect(screen.getByLabelText("Call letters:")).toBeEnabled();
    expect(screen.getByLabelText(/call numbers:/i)).toBeEnabled();
  });

  it("shows the rockCompLetters field only for genre 11 or 12 under the compilation radio", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);
    await selectGenre(user, "Blues");

    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    expect(screen.queryByLabelText(/rock comp/i)).not.toBeInTheDocument();

    await selectGenre(user, "Rock");
    expect(screen.getByLabelText(/rock comp/i)).toBeInTheDocument();

    await selectGenre(user, "Soundtracks");
    expect(screen.getByLabelText(/rock comp/i)).toBeInTheDocument();
  });

  it("shows the exact validation message when no radio is selected on submit", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("You must select one of the choices for Call Letters/Numbers."),
    ).toBeInTheDocument();
  });

  it("shows the exact validation message for empty artist letters in textbox mode", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);

    await user.click(screen.getByRole("radio", { name: /call letters:/i }));
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(await screen.findByText("You must enter artist letters.")).toBeInTheDocument();
  });

  it("shows the exact Rock message for genre 11 with an empty rockCompLetters field", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);
    await selectGenre(user, "Rock");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("Rock compilations require an additional letter field."),
    ).toBeInTheDocument();
  });

  it("shows the exact Soundtracks message for genre 12 with an empty rockCompLetters field", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);
    await selectGenre(user, "Soundtracks");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText("Soundtracks require an additional letter field."),
    ).toBeInTheDocument();
  });

  it("passes validation for the compilation radio under a non Rock/Soundtracks genre with no rockCompLetters", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);
    await selectGenre(user, "Blues");
    await user.click(screen.getByRole("radio", { name: /various artists/i }));

    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      screen.queryByText("You must select one of the choices for Call Letters/Numbers."),
    ).not.toBeInTheDocument();
  });

  it("notes the deferred code-resolution path once validation passes", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);

    await user.click(screen.getByRole("radio", { name: /call letters:/i }));
    await user.type(screen.getByLabelText("Call letters:"), "MO");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    expect(
      await screen.findByText(/code lookup is not yet available/i),
    ).toBeInTheDocument();
  });

  it("resets the mode and fields, including the genre back to its default, on Reset values", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm />);

    await selectGenre(user, "Rock");
    await user.click(screen.getByRole("radio", { name: /call letters:/i }));
    await user.type(screen.getByLabelText("Call letters:"), "MO");
    await user.type(screen.getByLabelText(/call numbers:/i), "12");

    await user.click(screen.getByRole("button", { name: "Reset values" }));

    expect(screen.getByRole("radio", { name: /call letters:/i })).not.toBeChecked();
    expect(screen.getByLabelText("Call letters:")).toHaveValue("");
    expect(screen.getByLabelText(/call numbers:/i)).toHaveValue("");
    // A native <input type=reset> restores a <select> to its default option
    // along with everything else — Rock must not survive the reset.
    expect(screen.getByLabelText(/^genre/i)).toHaveValue(String(BLUES_GENRE_ID));
  });
});
