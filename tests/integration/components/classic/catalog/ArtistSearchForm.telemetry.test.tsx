import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

// The real better-auth client installs listeners whose teardown is deferred a
// second past the last subscriber; a short file finishes inside that second.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSafeCapture = vi.fn();
// Spread the real module: `lib/error-reporting.ts` reaches the same module for
// `captureExceptionInPostHog` through the RTK Query error middleware, so a
// mock naming only `safeCapture` breaks an unrelated import in the store.
vi.mock("@/lib/posthog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/posthog")>();
  return { ...actual, safeCapture: (...args: unknown[]) => mockSafeCapture(...args) };
});

const mockOnMultiMatch = vi.fn();

import ArtistSearchForm from "@/src/components/experiences/classic/catalog/ArtistSearchForm";

const ROCK_GENRE_ID = 11;
const BY_CODE_URL = `${TEST_BACKEND_URL}/library/artists/by-code`;

function mockGenres() {
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/genres`, () =>
      HttpResponse.json([{ id: ROCK_GENRE_ID, genre_name: "Rock" }]),
    ),
  );
}

const owner = (id: number, codeLetters = "ME") => ({
  id,
  artist_name: `Owner ${id}`,
  code_letters: codeLetters,
  code_number: 47,
  genre_id: ROCK_GENRE_ID,
});

type CaptureCall = [string, Record<string, unknown>];

/** Every `library_code_search` capture, in call order. */
const codeSearchCaptures = (): CaptureCall[] =>
  mockSafeCapture.mock.calls.filter(
    (call): call is CaptureCall => call[0] === "library_code_search",
  );

async function submitTextboxCode(
  user: ReturnType<typeof renderWithProviders>["user"],
  letters: string,
  numbers: string,
) {
  await screen.findByRole("option", { name: "Rock" });
  await user.click(screen.getByRole("radio", { name: /call letters:/i }));
  if (letters) await user.type(screen.getByLabelText("Call letters:"), letters);
  if (numbers) await user.type(screen.getByLabelText(/call numbers:/i), numbers);
  await user.click(screen.getByRole("button", { name: "Search!" }));
}

/**
 * The chooser's code search is the screen a reported failure has to be
 * reconstructed from, and most of its endings leave no other trace: a librarian
 * can search, be refused inline, and leave without a request being issued. Each
 * case here pins one outcome the search can reach.
 */
describe("classic ArtistSearchForm — code search telemetry", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockOnMultiMatch.mockClear();
    mockSafeCapture.mockClear();
    mockGenres();
  });

  it("reports a single owner alongside the navigation it triggers", async () => {
    server.use(http.get(BY_CODE_URL, () => HttpResponse.json({ artists: [owner(19516)] })));
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await submitTextboxCode(user, "ME", "47");

    await waitFor(() => expect(codeSearchCaptures()).toHaveLength(1));
    expect(codeSearchCaptures()[0][1]).toMatchObject({
      outcome: "single_owner",
      call_letter_mode: "textbox",
      code_letters: "ME",
      code_number: 47,
      genre_id: ROCK_GENRE_ID,
      owner_count: 1,
    });
  });

  // The case the screen cannot record any other way: it changes no URL, so
  // without this event a librarian reaching a 27-row disambiguation list and
  // going back leaves no trace whatsoever.
  it("reports a multi-match, which no navigation would record", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ artists: [owner(1), owner(2), owner(3)] }),
      ),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await submitTextboxCode(user, "ME", "47");

    await waitFor(() => expect(mockOnMultiMatch).toHaveBeenCalledTimes(1));
    expect(codeSearchCaptures()[0][1]).toMatchObject({
      outcome: "multi_match",
      owner_count: 3,
    });
  });

  it("reports an unassigned code, which reads as a failure but is the create path", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ reason: "code_not_assigned" }, { status: 404 }),
      ),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await submitTextboxCode(user, "ME", "47");

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    expect(codeSearchCaptures()[0][1]).toMatchObject({ outcome: "not_assigned" });
  });

  it("separates an answer it cannot trust from an unassigned code", async () => {
    server.use(http.get(BY_CODE_URL, () => HttpResponse.json({}, { status: 500 })));
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await submitTextboxCode(user, "ME", "47");

    await waitFor(() => expect(codeSearchCaptures()).toHaveLength(1));
    expect(codeSearchCaptures()[0][1]).toMatchObject({ outcome: "lookup_untrusted" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  // The refusals are indistinguishable from outside — each renders an inline
  // message and issues no request — so the token is the only thing separating
  // them, and which one a librarian saw is what a reconstruction turns on.
  it("names which refusal an inline message came from", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await submitTextboxCode(user, "ME", "");

    await waitFor(() => expect(codeSearchCaptures()).toHaveLength(1));
    expect(codeSearchCaptures()[0][1]).toMatchObject({
      outcome: "refused",
      refusal: "call_number_required",
      call_letter_mode: "textbox",
    });
  });

  it("records a refusal that never reached the code composer at all", async () => {
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await screen.findByRole("option", { name: "Rock" });
    await user.click(screen.getByRole("button", { name: "Search!" }));

    await waitFor(() => expect(codeSearchCaptures()).toHaveLength(1));
    expect(codeSearchCaptures()[0][1]).toMatchObject({
      outcome: "refused",
      refusal: "call_letter_mode_required",
      call_letter_mode: null,
    });
  });

  // Compilation mode composes `V/A`/0 rather than reading the textboxes, so
  // the mode is what tells the two search shapes apart after the fact.
  it("carries the compilation mode and the pair it composes", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ artists: [owner(1, "V/A"), owner(2, "V/A")] }),
      ),
    );
    const { user } = renderWithProviders(<ArtistSearchForm onMultiMatch={mockOnMultiMatch} />);

    await screen.findByRole("option", { name: "Rock" });
    await user.click(screen.getByRole("radio", { name: /various artists/i }));
    await user.type(screen.getByLabelText("Rock comp letter"), "A");
    await user.click(screen.getByRole("button", { name: "Search!" }));

    await waitFor(() => expect(codeSearchCaptures()).toHaveLength(1));
    expect(codeSearchCaptures()[0][1]).toMatchObject({
      call_letter_mode: "compilation",
      code_letters: "V/A",
      code_number: 0,
    });
  });
});
