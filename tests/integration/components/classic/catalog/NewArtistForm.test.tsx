import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", () => ({
  authClient: { useSession: vi.fn() },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

import NewArtistForm from "@/src/components/experiences/classic/catalog/NewArtistForm";

const GENRE_ID = 3;

function mockGenres(genres: { id: number; genre_name: string }[] = [{ id: GENRE_ID, genre_name: "Blues" }]) {
  server.use(http.get(`${TEST_BACKEND_URL}/library/genres`, () => HttpResponse.json(genres)));
}

function mockPeekCode(next_code_number = 7) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
      HttpResponse.json({ next_code_number }),
    ),
  );
}

function mockAddArtist(
  respond: (body: unknown) => Response | Promise<Response>,
): { getBodies: () => unknown[] } {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${TEST_BACKEND_URL}/library/artists`, async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return respond(body);
    }),
  );
  return { getBodies: () => bodies };
}

function created(overrides: Record<string, unknown> = {}) {
  return HttpResponse.json(
    {
      id: 99,
      artist_name: "Juana Molina",
      code_letters: "MO",
      code_number: 12,
      genre_id: GENRE_ID,
      ...overrides,
    },
    { status: 201 },
  );
}

async function selectGenre(user: ReturnType<typeof renderWithProviders>["user"], name = "Blues") {
  await screen.findByRole("option", { name });
  await user.selectOptions(screen.getByLabelText(/genre/i), name);
}

describe("classic NewArtistForm — chooseLibraryCodeOrArtist.jsp's newArtistForm", () => {
  beforeEach(() => {
    mockGenres();
    mockPeekCode();
  });

  it("renders tubafrenzy's field order and labels", async () => {
    renderWithProviders(<NewArtistForm />);

    expect(
      await screen.findByText(/create a brand new artist with no specific library code information/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/artist presentation name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist alphabetical name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset values" })).toBeInTheDocument();
  });

  it("shows the JSP's exact validation message when the presentation name is empty", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);
    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The presentation name cannot be empty.")).toBeInTheDocument();
  });

  it("shows the JSP's exact validation message when the alphabetical name is empty", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);
    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The alphabetical name cannot be empty.")).toBeInTheDocument();
  });

  it("submits POST /library/artists end to end with the typed fields", async () => {
    const { getBodies } = mockAddArtist(() => created());
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(getBodies()).toHaveLength(1));
    expect(getBodies()[0]).toEqual({
      artist_name: "Juana Molina",
      alphabetical_name: "Molina, Juana",
      code_letters: "MO",
      genre_id: GENRE_ID,
      code_number: 12,
    });
  });

  it("previews the next code number for the typed call letters/genre pair", async () => {
    mockPeekCode(7);
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/call letters/i), "MO");

    expect(await screen.findByText(/next code:\s*7/i)).toBeInTheDocument();
  });

  it("confirms the assigned code from the server response after submit", async () => {
    mockAddArtist(() => created({ code_letters: "MO", code_number: 12 }));
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/Added as MO12/i)).toBeInTheDocument();
  });

  it("resets every field back to empty on Reset values", async () => {
    const { user } = renderWithProviders(<NewArtistForm />);

    await selectGenre(user);
    await user.type(screen.getByLabelText(/artist presentation name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/artist alphabetical name/i), "Molina, Juana");
    await user.type(screen.getByLabelText(/call letters/i), "MO");
    await user.type(screen.getByLabelText(/call numbers/i), "12");

    await user.click(screen.getByRole("button", { name: "Reset values" }));

    expect(screen.getByLabelText(/artist presentation name/i)).toHaveValue("");
    expect(screen.getByLabelText(/artist alphabetical name/i)).toHaveValue("");
    expect(screen.getByLabelText(/call letters/i)).toHaveValue("");
    expect(screen.getByLabelText(/call numbers/i)).toHaveValue("");
  });
});
