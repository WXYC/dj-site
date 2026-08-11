import { describe, it, expect } from "vitest";

import {
  flowsheetArtistRejection,
  isVariousArtistsEntry,
  MISSING_ARTIST_REJECTION_MESSAGE,
  queueAdditionMessage,
  releaseCannotSupplyArtist,
  releaseCreditIsRefused,
  seedableArtistName,
  VARIOUS_ARTISTS_REJECTION_MESSAGE,
} from "@/lib/features/flowsheet/various-artists-guard";

describe("isVariousArtistsEntry", () => {
  it.each([
    "Various Artists",
    "various artists",
    "VARIOUS ARTISTS",
    "Various Artist",
    "Various",
    "  Various   Artists  ",
    "V/A",
    "v/a",
    "V / A",
    "V.A.",
    "v.a.",
    "Soundtrack",
    "Original Soundtrack",
    "Original Motion Picture Soundtrack",
    "OST",
    "Compilation",
  ])("refuses the compilation designation %s", (input) => {
    expect(isVariousArtistsEntry(input)).toBe(true);
  });

  // The two spellings the shared release-artist predicate deliberately allows.
  // In the artist field of a flowsheet entry they are only ever shorthand for
  // the compilation credit, and tubafrenzy has refused both for years.
  it.each(["VA", "va", "V A", "v a", "Var. Artists", "Var Artists", "var. artist"])(
    "refuses the abbreviated compilation credit %s",
    (input) => {
      expect(isVariousArtistsEntry(input)).toBe(true);
    }
  );

  it.each([
    "Juana Molina",
    "Stereolab",
    "Cat Power",
    "Jessica Pratt",
    "Chuquimamani-Condori",
    "Duke Ellington & John Coltrane",
    "Nilüfer Yanya",
    // Real artists whose names embed a keyword — the whole-name anchoring is
    // what keeps these submittable.
    "Various Production",
    "The Soundtrack of Our Lives",
    "Death By Compilation",
    "Vamping In Vegas",
    "Variant Configuration",
    // "Van" and "Vast" start with the same two letters as the "v...a" arm
    // without being an abbreviation of it.
    "Van Morrison",
    "Vashti Bunyan",
  ])("allows the performing artist %s", (input) => {
    expect(isVariousArtistsEntry(input)).toBe(false);
  });

  it.each([null, undefined, "", "   "])(
    "allows empty input %s — emptiness is a separate check",
    (input) => {
      expect(isVariousArtistsEntry(input)).toBe(false);
    }
  );
});

describe("releaseCreditIsRefused", () => {
  // This is what drives the rotation artist field and the freeform routing.
  // Keying either on `isCompilationRelease` instead leaves a hole in both
  // directions, so the divergent cases are pinned here.
  it.each(["Various Artists", "V/A", "VA", "Var. Artists", "Soundtrack"])(
    "is true for a release credited %s",
    (name) => {
      expect(releaseCreditIsRefused({ artist: { name } })).toBe(true);
    }
  );

  it("is false for a compilation filed under a credited album artist", () => {
    // An isCompilationRelease whose name the guard never refuses: it is
    // submittable as-is and must keep its library linkage.
    expect(
      releaseCreditIsRefused({ artist: { name: "Kruder & Dorfmeister" } })
    ).toBe(false);
  });

  it.each([null, { artist: null }, { artist: { name: null } }])(
    "is false for a release with no credit (%s)",
    (release) => {
      expect(releaseCreditIsRefused(release)).toBe(false);
    }
  );
});

describe("seedableArtistName", () => {
  it("passes through a performing artist", () => {
    expect(seedableArtistName({ artist: { name: "Jessica Pratt" } })).toBe(
      "Jessica Pratt"
    );
  });

  it.each(["Various Artists", "VA", "Var. Artists"])(
    "blanks the refused credit %s rather than seeding it",
    (name) => {
      expect(seedableArtistName({ artist: { name } })).toBe("");
    }
  );

  it("returns an empty string for a null-artist release", () => {
    expect(seedableArtistName({ artist: null })).toBe("");
  });
});

describe("releaseCannotSupplyArtist", () => {
  it.each(["Various Artists", "VA", "Var. Artists"])(
    "is true for a release credited %s",
    (name) => {
      expect(releaseCannotSupplyArtist({ artist: { name } })).toBe(true);
    }
  );

  // The other route to the same blank field: nothing was refused, there was
  // simply nothing to seed.
  it.each([
    ["a null artist", { artist: null }],
    ["an absent artist", {}],
    ["an empty name", { artist: { name: "" } }],
    ["a whitespace-only name", { artist: { name: "   " } }],
  ])("is true for %s", (_label, release) => {
    expect(releaseCannotSupplyArtist(release)).toBe(true);
  });

  it("is false for a release that names its performer", () => {
    expect(
      releaseCannotSupplyArtist({ artist: { name: "Chuquimamani-Condori" } })
    ).toBe(false);
  });
});

describe("flowsheetArtistRejection", () => {
  it.each([null, undefined, "", "   ", "\t\n"])(
    "asks for a performer when the artist is blank (%s)",
    (artist) => {
      expect(flowsheetArtistRejection(artist)).toBe(
        MISSING_ARTIST_REJECTION_MESSAGE
      );
    }
  );

  it.each(["Various Artists", "V/A", "VA", "Var. Artists", "Soundtrack"])(
    "refuses the compilation credit %s with its own copy",
    (artist) => {
      expect(flowsheetArtistRejection(artist)).toBe(
        VARIOUS_ARTISTS_REJECTION_MESSAGE
      );
    }
  );

  // A DJ who left the field empty never typed "Various Artists", so the two
  // conditions must never borrow each other's copy.
  it("distinguishes the two refusals", () => {
    expect(MISSING_ARTIST_REJECTION_MESSAGE).not.toBe(
      VARIOUS_ARTISTS_REJECTION_MESSAGE
    );
  });

  it.each([
    "Juana Molina",
    "Stereolab",
    "Duke Ellington & John Coltrane",
    "The Soundtrack of Our Lives",
  ])("passes the submittable performer %s", (artist) => {
    expect(flowsheetArtistRejection(artist)).toBeNull();
  });
});

describe("queueAdditionMessage", () => {
  it("confirms the addition without a caveat for a credited release", () => {
    expect(
      queueAdditionMessage({
        title: "On Your Own Love Again",
        artist: { name: "Jessica Pratt" },
      })
    ).toBe("Added On Your Own Love Again to queue");
  });

  // The conversion queues a refused credit blank, so a bare "added" would let
  // the DJ meet the requirement for the first time at the Play refusal.
  it.each(["Various Artists", "VA", "Var. Artists"])(
    "names what is still missing for a release credited %s",
    (name) => {
      expect(queueAdditionMessage({ title: "Edits", artist: { name } })).toBe(
        "Added Edits to queue. Name the performer in the artist cell before playing it."
      );
    }
  );

  // A release carrying no credit is queued just as blank as one whose credit
  // is refused, and withholds its linkage on the same terms. The caveat has
  // to track what the queue row is missing, not which route left it empty —
  // otherwise this release is the one case that reaches the Play refusal
  // unwarned.
  it.each([
    { label: "an empty credit", artist: { name: "" } },
    { label: "a null credit name", artist: { name: null } },
    { label: "no artist at all", artist: null },
  ])("names what is still missing for a release with $label", ({ artist }) => {
    expect(queueAdditionMessage({ title: "Edits", artist })).toBe(
      "Added Edits to queue. Name the performer in the artist cell before playing it."
    );
  });
});
