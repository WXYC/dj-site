import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/tests/helpers";

// The code preview is MD-gated and carries its own spec; here only the code it
// is handed matters, so it stands in as a probe rather than dragging the auth
// stack into a test about three text fields.
vi.mock("@/src/components/shared/inputs/CallLetterPeekControl", () => ({
  default: ({ code_letters }: { code_letters: string }) => (
    <div data-testid="peek-probe" data-code={code_letters} />
  ),
}));

import NewArtistFields, {
  type CodeLettersField,
  type NewArtistConflict,
} from "@/src/components/shared/inputs/NewArtistFields";

const MOLINA = TEST_SEARCH_STRINGS.CODE_LETTERS.MOLINA;

function Harness({
  initialCodeLetters = "",
  conflict = null,
}: {
  initialCodeLetters?: string;
  conflict?: NewArtistConflict | null;
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
      genreId={TEST_ENTITY_IDS.GENRE.ROCK}
      disabled={false}
      conflict={conflict}
    />
  );
}

function callLettersInput() {
  return screen.getByLabelText("Call letters") as HTMLInputElement;
}

function peekedCode() {
  return screen.getByTestId("peek-probe").getAttribute("data-code");
}

describe("NewArtistFields", () => {
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
    expect(screen.getByText("Must be a positive whole number")).toBeDefined();

    await user.clear(codeNumber);
    await user.type(codeNumber, "2147483648");
    expect(
      screen.getByText("Must be no greater than 2147483647"),
    ).toBeDefined();
  });

  it("withholds an over-long code from the preview", () => {
    // Uppercasing can push a value past the field's own maxLength ("ßxß"
    // becomes "SSXSS"), which no series can hold — previewing it would answer
    // "Next code: 1" beside the length error that blocks the submit.
    renderWithProviders(<Harness initialCodeLetters="MOXYZ" />);

    expect(peekedCode()).toBe("");
  });

  it("passes a filable code straight through to the preview", () => {
    renderWithProviders(<Harness initialCodeLetters={MOLINA} />);

    expect(peekedCode()).toBe(MOLINA);
  });

  it("names the artist holding a rejected code triple", () => {
    renderWithProviders(
      <Harness
        conflict={{
          code_letters: TEST_SEARCH_STRINGS.CODE_LETTERS.STEREOLAB,
          code_number: "87",
          name: "Stereolab",
          response: {
            artist: {
              artist_id: 4,
              artist_name: "Cat Power",
              code_letters: TEST_SEARCH_STRINGS.CODE_LETTERS.STEREOLAB,
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
          code_letters: TEST_SEARCH_STRINGS.CODE_LETTERS.STEREOLAB,
          code_number: "87",
          name: "Stereolab",
          response: {
            artist: {
              artist_id: 4,
              artist_name: "Stereolab",
              code_letters: TEST_SEARCH_STRINGS.CODE_LETTERS.STEREOLAB,
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
    // submission was refused either way; the server's message reaches the MD
    // through the global toast instead.
    renderWithProviders(
      <Harness
        conflict={{
          code_letters: TEST_SEARCH_STRINGS.CODE_LETTERS.STEREOLAB,
          code_number: "87",
          name: "Stereolab",
          response: null,
        }}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
