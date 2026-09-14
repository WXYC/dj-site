import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import {
  renderWithProviders,
  server,
  TEST_BACKEND_URL,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

import NewArtistFields, {
  type CodeLettersField,
  type NewArtistConflict,
} from "@/src/components/shared/inputs/NewArtistFields";

const MOLINA = TEST_SEARCH_STRINGS.CODE_LETTERS.MOLINA;
const STEREOLAB = TEST_SEARCH_STRINGS.CODE_LETTERS.STEREOLAB;
const GENRE_ID = TEST_ENTITY_IDS.GENRE.ROCK;

/** Captures peek-code traffic; the number answered is keyed on the letters. */
function mockPeekCode(respond: (codeLetters: string) => number = () => 7) {
  let requestCount = 0;
  let receivedParams: URLSearchParams | undefined;
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, ({ request }) => {
      requestCount += 1;
      receivedParams = new URL(request.url).searchParams;
      return HttpResponse.json({
        next_code_number: respond(receivedParams.get("code_letters") ?? ""),
      });
    }),
  );
  return {
    getReceivedParams: () => receivedParams,
    getRequestCount: () => requestCount,
  };
}

function Harness({
  initialCodeLetters = "",
  conflict = null,
  genreId = GENRE_ID,
  autoFillCodeNumber = false,
}: {
  initialCodeLetters?: string;
  conflict?: NewArtistConflict | null;
  genreId?: number | null;
  autoFillCodeNumber?: boolean;
}) {
  const [codeLettersField, setCodeLettersField] = useState<CodeLettersField>({
    value: initialCodeLetters,
    caret: null,
  });
  const [codeNumberRaw, setCodeNumberRaw] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");

  return (
    <NewArtistFields
      alphabeticalName={alphabeticalName}
      codeNumberRaw={codeNumberRaw}
      codeLettersField={codeLettersField}
      onCodeLettersFieldChange={setCodeLettersField}
      onCodeNumberChange={setCodeNumberRaw}
      onAlphabeticalNameChange={setAlphabeticalName}
      genreId={genreId}
      disabled={false}
      conflict={conflict}
      autoFillCodeNumber={autoFillCodeNumber}
    />
  );
}

/** Controlled variant for pinning how the peek reacts to letters moving. */
function ControlledLetters({ codeLetters }: { codeLetters: string }) {
  return (
    <NewArtistFields
      alphabeticalName=""
      codeNumberRaw=""
      codeLettersField={{ value: codeLetters, caret: null }}
      onCodeLettersFieldChange={() => {}}
      onCodeNumberChange={() => {}}
      onAlphabeticalNameChange={() => {}}
      genreId={GENRE_ID}
      disabled={false}
      conflict={null}
    />
  );
}

function callLettersInput() {
  return screen.getByLabelText("Call letters") as HTMLInputElement;
}

function codeNumberInput() {
  return screen.getByLabelText("Code number") as HTMLInputElement;
}

describe("NewArtistFields", () => {
  beforeEach(() => {
    mockPeekCode();
  });

  it("renders the three fields an artist row needs", () => {
    renderWithProviders(<Harness />);

    expect(screen.getByLabelText("Alphabetical name (optional)")).toBeDefined();
    expect(screen.getByLabelText("Call letters")).toBeDefined();
    expect(screen.getByLabelText("Code number")).toBeDefined();
  });

  it("files call letters uppercase whatever the MD types", async () => {
    // The backend compares this column for equality on a non-citext btree and
    // the catalog is filed uppercase, so lowercase "mo" would open a second
    // series shadowing the real "MO" one while the form reported success.
    const { user } = renderWithProviders(<Harness />);

    await user.type(callLettersInput(), MOLINA.toLowerCase());

    expect(callLettersInput().value).toBe(MOLINA);
  });

  it("preserves punctuation and digits that are real filed codes", async () => {
    // "V/A", "??" and digit-bearing codes are all live in the catalog, so the
    // field normalizes case and nothing else.
    const { user } = renderWithProviders(<Harness />);

    await user.type(callLettersInput(), "v/a");

    expect(callLettersInput().value).toBe("V/A");
  });

  it("leaves the caret where a mid-code edit put it", async () => {
    // Writing the normalized value back into a controlled input drops the
    // caret at the end of the field. Left alone, the next keystroke lands
    // there and files a different — but still valid-looking — code, onto a
    // physical card.
    const { user } = renderWithProviders(<Harness initialCodeLetters={MOLINA} />);
    const input = callLettersInput();

    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.keyboard("x");

    expect(input.value).toBe("MXO");
    expect(input.selectionStart).toBe(2);
  });

  it("names the range ceiling rather than repeating the integer error", async () => {
    const { user } = renderWithProviders(<Harness />);
    const codeNumber = screen.getByLabelText("Code number");

    await user.type(codeNumber, "abc");
    expect(screen.getByText("Must be a whole number")).toBeDefined();

    await user.clear(codeNumber);
    await user.type(codeNumber, "2147483648");
    expect(
      screen.getByText("Must be no greater than 2147483647"),
    ).toBeDefined();
  });

  it("does not flag a deliberate 0, which the server files legally", async () => {
    const { user } = renderWithProviders(<Harness />);

    await user.type(screen.getByLabelText("Code number"), "0");

    expect(screen.queryByText("Must be a whole number")).toBeNull();
  });

  describe("code peek", () => {
    // The fetch behavior pinned here belongs to useArtistCodePeek, whose one
    // production mount point is this field group.

    it("queries peek-code with the current letters and genre and previews the answer", async () => {
      const { getReceivedParams } = mockPeekCode();
      renderWithProviders(<Harness initialCodeLetters={MOLINA} />);

      await waitFor(() => {
        const params = getReceivedParams();
        expect(params?.get("code_letters")).toBe(MOLINA);
        expect(params?.get("genre_id")).toBe(String(GENRE_ID));
      });
      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");
    });

    it.each([
      ["blank letters", <Harness key="blank" initialCodeLetters="" />],
      ["whitespace-only letters", <Harness key="ws" initialCodeLetters="   " />],
      ["no genre selected", <Harness key="genre" initialCodeLetters={MOLINA} genreId={null} />],
      // Uppercasing can push a value past the field's own maxLength ("ßxß"
      // becomes "SSXSS"), which no series can ever hold — previewing it would
      // answer "Next code: 1" beside the length error that blocks the submit.
      ["over-long letters", <Harness key="long" initialCodeLetters="MOXYZ" />],
    ])("neither queries nor previews with %s", async (_label, harness) => {
      const { getRequestCount } = mockPeekCode();
      renderWithProviders(harness);

      // The debounce window has to pass before a negative means anything.
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(screen.queryByText("Next code:")).not.toBeInTheDocument();
      expect(getRequestCount()).toBe(0);
    });

    it("coalesces rapid letter changes into a single debounced request", async () => {
      const { getRequestCount } = mockPeekCode();
      const { rerender } = renderWithProviders(
        <ControlledLetters codeLetters={MOLINA} />,
      );

      // Let the control mount and settle before exercising rapid changes, so
      // the debounce hook is already live rather than seeding fresh off a
      // cold mount (which would trivially coalesce even without debouncing).
      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");
      expect(getRequestCount()).toBe(1);

      rerender(<ControlledLetters codeLetters="MOX" />);
      rerender(<ControlledLetters codeLetters="MOXY" />);
      rerender(<ControlledLetters codeLetters={STEREOLAB} />);

      await waitFor(() => expect(getRequestCount()).toBe(2));
      expect(screen.getByTestId("next-code-number")).toHaveTextContent("7");
    });

    it("shows a loading state instead of the previous letters' number during the debounce window", async () => {
      mockPeekCode();
      const { rerender } = renderWithProviders(
        <ControlledLetters codeLetters={MOLINA} />,
      );

      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");

      rerender(<ControlledLetters codeLetters={STEREOLAB} />);

      expect(screen.queryByTestId("next-code-number")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Loading next code number")).toBeInTheDocument();
    });

    it("does not let a slow response for superseded letters overwrite the current number", async () => {
      let molinaRequestStarted = false;
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, async ({ request }) => {
          const codeLetters = new URL(request.url).searchParams.get("code_letters");
          if (codeLetters === MOLINA) {
            molinaRequestStarted = true;
            await delay(600);
            return HttpResponse.json({ next_code_number: 1 });
          }
          return HttpResponse.json({ next_code_number: 2 });
        }),
      );
      const { rerender } = renderWithProviders(
        <ControlledLetters codeLetters={MOLINA} />,
      );

      // Let the slow MOLINA request actually go in flight before switching.
      await waitFor(() => expect(molinaRequestStarted).toBe(true));

      rerender(<ControlledLetters codeLetters={STEREOLAB} />);

      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("2");

      // Let the superseded MOLINA response land; it must never overwrite the
      // now-current STEREOLAB value.
      await delay(700);
      expect(screen.getByTestId("next-code-number")).toHaveTextContent("2");
    });

    it("names a failed peek instead of previewing", async () => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () =>
          HttpResponse.json({ error: "rejected" }, { status: 500 }),
        ),
      );
      renderWithProviders(<Harness initialCodeLetters={MOLINA} />);

      expect(await screen.findByText("Unable to preview code")).toBeInTheDocument();
    });
  });

  describe("code-number auto-fill", () => {
    it("keeps the field empty without the opt-in, ArtistAddForm's typed-only contract", async () => {
      renderWithProviders(<Harness initialCodeLetters={MOLINA} />);

      expect(await screen.findByTestId("next-code-number")).toHaveTextContent("7");
      expect(codeNumberInput().value).toBe("");
    });

    it("renders the live peeked number while the draft is clean", async () => {
      renderWithProviders(<Harness initialCodeLetters={MOLINA} autoFillCodeNumber />);

      await waitFor(() => expect(codeNumberInput().value).toBe("7"));
    });

    it("lets a dirty draft survive a peek refresh untouched", async () => {
      mockPeekCode((codeLetters) => (codeLetters === MOLINA ? 7 : 9));
      const { user } = renderWithProviders(
        <Harness initialCodeLetters={MOLINA} autoFillCodeNumber />,
      );
      await waitFor(() => expect(codeNumberInput().value).toBe("7"));

      // Replace, not append: the MD's deliberate number takes the field over.
      await user.tripleClick(codeNumberInput());
      await user.keyboard("12");
      expect(codeNumberInput().value).toBe("12");

      // Move the letters so the peek refetches and answers differently.
      await user.type(callLettersInput(), "X");
      await screen.findByTestId("next-code-number");
      await waitFor(() =>
        expect(screen.getByTestId("next-code-number")).toHaveTextContent("9"),
      );
      expect(codeNumberInput().value).toBe("12");
    });

    it("returns a cleared draft to the live peek — omission files that number anyway", async () => {
      const { user } = renderWithProviders(
        <Harness initialCodeLetters={MOLINA} autoFillCodeNumber />,
      );
      await waitFor(() => expect(codeNumberInput().value).toBe("7"));

      await user.tripleClick(codeNumberInput());
      await user.keyboard("12");
      expect(codeNumberInput().value).toBe("12");

      await user.tripleClick(codeNumberInput());
      await user.keyboard("{Backspace}");
      await waitFor(() => expect(codeNumberInput().value).toBe("7"));
    });
  });

  it("names the artist holding a rejected code triple", () => {
    renderWithProviders(
      <Harness
        conflict={{
          code_letters: STEREOLAB,
          code_number: "87",
          name: "Stereolab",
          response: {
            artist: {
              artist_id: 4,
              artist_name: "Cat Power",
              code_letters: STEREOLAB,
            },
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "ST87 is already taken by Cat Power.",
    );
  });

  it("names the artist holding a rejected name", () => {
    renderWithProviders(
      <Harness
        conflict={{
          code_letters: STEREOLAB,
          code_number: "87",
          name: "Stereolab",
          response: {
            artist: {
              artist_id: 4,
              artist_name: "Stereolab",
              code_letters: STEREOLAB,
            },
            reason: "artist_name_conflict",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Stereolab is already taken in this genre by Stereolab.",
    );
  });

  it("renders no banner for a 409 that named no artist", () => {
    // An intermediary's own JSON, or a shape this form cannot read. The
    // submission was refused either way; the caller owns the fallback report.
    renderWithProviders(
      <Harness
        conflict={{
          code_letters: STEREOLAB,
          code_number: "87",
          name: "Stereolab",
          response: null,
        }}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
