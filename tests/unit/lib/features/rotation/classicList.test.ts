import { describe, it, expect } from "vitest";
import {
  isRotationRowActive,
  formatRotationDate,
  rotationLibraryStatus,
  dedupeRotationListByArtistTitle,
  toDisplayRowFromList,
  toDisplayRowFromUncatalogued,
} from "@/lib/features/rotation/classicList";
import { RotationBin, type RotationListRow, type UncataloguedRotationRow } from "@/lib/features/rotation/types";

const NOW = new Date("2026-08-29T12:00:00.000Z");

function listRow(overrides: Partial<RotationListRow> = {}): RotationListRow {
  return {
    id: 1001,
    code_letters: "MOL",
    code_artist_number: 1,
    code_number: 1,
    artist_name: "Juana Molina",
    alphabetical_name: "Molina, Juana",
    album_title: "DOGA",
    record_label: "Sonamos",
    label_id: 5,
    genre_name: "Rock",
    format_name: "CD",
    rotation_id: 5001,
    add_date: "2026-08-01",
    rotation_add_date: "2026-08-01",
    rotation_bin: RotationBin.H,
    rotation_kill_date: null,
    plays: 3,
    legacy_release_id: 7001,
    ...overrides,
  };
}

function uncataloguedRow(overrides: Partial<UncataloguedRotationRow> = {}): UncataloguedRotationRow {
  return {
    id: 6001,
    album_id: null,
    rotation_bin: RotationBin.M,
    add_date: "2026-08-10",
    kill_date: null,
    artist_name: "LOS THUTHANAKA",
    album_title: "Wak'a",
    record_label: "self-released",
    ...overrides,
  };
}

describe("isRotationRowActive", () => {
  it("treats a null kill_date as active", () => {
    expect(isRotationRowActive(null, NOW)).toBe(true);
  });

  it("treats a future kill_date as active", () => {
    expect(isRotationRowActive("2026-09-01", NOW)).toBe(true);
  });

  it("treats today's kill_date as killed, not active", () => {
    expect(isRotationRowActive("2026-08-29", NOW)).toBe(false);
  });

  it("treats a past kill_date as killed", () => {
    expect(isRotationRowActive("2026-01-01", NOW)).toBe(false);
  });
});

describe("formatRotationDate", () => {
  it("formats an ISO date as MM/DD/YY, matching DateTimeManager.getLongDateAsMMDDYY", () => {
    expect(formatRotationDate("2026-08-01")).toBe("08/01/26");
  });

  it("returns an empty string for a null date", () => {
    expect(formatRotationDate(null)).toBe("");
  });

  it("never shifts the calendar day through a Date/timezone conversion", () => {
    // A naive `new Date("2026-01-01")` interprets the string as UTC midnight,
    // which renders as 2025-12-31 in any timezone west of UTC. This must
    // read the digits directly instead.
    expect(formatRotationDate("2026-01-01")).toBe("01/01/26");
  });
});

describe("rotationLibraryStatus", () => {
  it("reports cataloged for a linked row regardless of kill status", () => {
    expect(rotationLibraryStatus(true, false)).toBe("cataloged");
    expect(rotationLibraryStatus(true, true)).toBe("cataloged");
  });

  it("reports uncataloged for an unlinked, killed row", () => {
    expect(rotationLibraryStatus(false, true)).toBe("uncataloged");
  });

  it("reports unknown for an unlinked, active row (the JSP's em-dash)", () => {
    expect(rotationLibraryStatus(false, false)).toBe("unknown");
  });
});

describe("toDisplayRowFromList", () => {
  it("treats a 0 library id the same as null -- the 0-and-NULL unlinked sentinel", () => {
    // tubafrenzy historically wrote a literal 0 for "unlinked"; Backend
    // writes NULL. `id` here is `library.id` from a LEFT JOIN, which Postgres
    // can never populate with a literal 0 (library.id is a serial starting at
    // 1) -- but the predicate must not assume that and must reject 0 as a
    // linked id defensively, matching `hasLinkedAlbumId`'s `> 0` guard.
    const zero = toDisplayRowFromList(listRow({ id: 0 }), NOW);
    const nullId = toDisplayRowFromList(listRow({ id: null }), NOW);
    expect(zero.libraryStatus).toBe(nullId.libraryStatus);
    expect(zero.libraryStatus).not.toBe("cataloged");
  });

  it("reports cataloged for a positive library id", () => {
    const row = toDisplayRowFromList(listRow({ id: 42 }), NOW);
    expect(row.libraryStatus).toBe("cataloged");
  });

  it("reports uncataloged only for an unlinked row that carries a kill date", () => {
    const activeUnlinked = toDisplayRowFromList(listRow({ id: null, rotation_kill_date: null }), NOW);
    const killedUnlinked = toDisplayRowFromList(
      listRow({ id: null, rotation_kill_date: "2026-01-01" }),
      NOW,
    );
    const killedLinked = toDisplayRowFromList(listRow({ id: 42, rotation_kill_date: "2026-01-01" }), NOW);
    expect(activeUnlinked.libraryStatus).toBe("unknown");
    expect(killedUnlinked.libraryStatus).toBe("uncataloged");
    expect(killedLinked.libraryStatus).toBe("cataloged");
  });

  // The JSP keys its Killed column, its Kill/Unkill choice and its Library
  // column on `release.killDate == 0`, not on whether the kill date has
  // arrived. A row killed as of next week is still in rotation today and is
  // already killed.
  it("keeps a future kill date visible while still reporting the row as active", () => {
    const row = toDisplayRowFromList(listRow({ id: null, rotation_kill_date: "2026-09-05" }), NOW);
    expect(row.killedDisplay).toBe("09/05/26");
    expect(row.active).toBe(true);
    expect(row.libraryStatus).toBe("uncataloged");
  });

  it("carries no kill display at all for a row that was never killed", () => {
    const row = toDisplayRowFromList(listRow({ rotation_kill_date: null }), NOW);
    expect(row.killedDisplay).toBeNull();
    expect(row.active).toBe(true);
  });

  it("carries the rotation row's own id for Edit/Kill/Unkill, not the library id", () => {
    const row = toDisplayRowFromList(listRow({ rotation_id: 5001, id: 42 }), NOW);
    expect(row.rotationId).toBe(5001);
  });
});

describe("toDisplayRowFromUncatalogued", () => {
  it("is always uncataloged when killed and unknown when never killed -- rows here are unlinked by construction", () => {
    const active = toDisplayRowFromUncatalogued(uncataloguedRow({ kill_date: null }), NOW);
    const killed = toDisplayRowFromUncatalogued(uncataloguedRow({ kill_date: "2026-01-01" }), NOW);
    expect(active.libraryStatus).toBe("unknown");
    expect(killed.libraryStatus).toBe("uncataloged");
  });

  it("keeps a future kill date visible while still reporting the row as active", () => {
    const row = toDisplayRowFromUncatalogued(uncataloguedRow({ kill_date: "2026-09-05" }), NOW);
    expect(row.killedDisplay).toBe("09/05/26");
    expect(row.active).toBe(true);
  });

  it("treats an album_id of 0 the same as null -- defensive against the tubafrenzy sentinel", () => {
    const zero = toDisplayRowFromUncatalogued(uncataloguedRow({ album_id: 0 }), NOW);
    expect(zero.libraryStatus).not.toBe("cataloged");
  });
});

describe("dedupeRotationListByArtistTitle", () => {
  it("collapses rows sharing an artist and title, keeping the first (most recent)", () => {
    const rows = [
      listRow({ rotation_id: 1, artist_name: "LOS THUTHANAKA", album_title: "Wak'a", rotation_add_date: "2026-08-03" }),
      listRow({ rotation_id: 2, artist_name: "LOS THUTHANAKA", album_title: "Wak'a", rotation_add_date: "2026-08-02" }),
      listRow({ rotation_id: 3, artist_name: "LOS THUTHANAKA", album_title: "Wak'a", rotation_add_date: "2026-08-01" }),
    ];

    const deduped = dedupeRotationListByArtistTitle(rows);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.rotation_id).toBe(1);
  });

  it("is case- and whitespace-insensitive on both artist and title", () => {
    const rows = [
      listRow({ rotation_id: 1, artist_name: "ear", album_title: "Rumspringa" }),
      listRow({ rotation_id: 2, artist_name: "  Ear  ", album_title: "rumspringa" }),
    ];

    expect(dedupeRotationListByArtistTitle(rows)).toHaveLength(1);
  });

  it("keeps rows with distinct artist/title pairs", () => {
    const rows = [
      listRow({ rotation_id: 1, artist_name: "Jessica Pratt", album_title: "On Your Own Love Again" }),
      listRow({ rotation_id: 2, artist_name: "Chuquimamani-Condori", album_title: "Edits" }),
    ];

    expect(dedupeRotationListByArtistTitle(rows)).toHaveLength(2);
  });

  it("treats a null artist or title as its own key rather than crashing", () => {
    const rows = [
      listRow({ rotation_id: 1, artist_name: null, album_title: null }),
      listRow({ rotation_id: 2, artist_name: null, album_title: null }),
    ];

    expect(dedupeRotationListByArtistTitle(rows)).toHaveLength(1);
  });
});

describe("dedupeRotationListByArtistTitle — ordering and key separation", () => {
  it("keeps the most recently added row regardless of the order it is handed", () => {
    const rows = [
      listRow({ rotation_id: 3, artist_name: "LOS THUTHANAKA", album_title: "Wak'a", rotation_add_date: "2026-08-01", rotation_bin: RotationBin.H }),
      listRow({ rotation_id: 1, artist_name: "LOS THUTHANAKA", album_title: "Wak'a", rotation_add_date: "2026-08-03", rotation_bin: RotationBin.L }),
      listRow({ rotation_id: 2, artist_name: "LOS THUTHANAKA", album_title: "Wak'a", rotation_add_date: "2026-08-02", rotation_bin: RotationBin.M }),
    ];

    const deduped = dedupeRotationListByArtistTitle(rows);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.rotation_id).toBe(1);
    expect(deduped[0]?.rotation_bin).toBe(RotationBin.L);
  });

  it("orders the surviving rows most-recently-added first, matching the JSP's own ORDER BY", () => {
    const rows = [
      listRow({ rotation_id: 1, artist_name: "Jessica Pratt", album_title: "On Your Own Love Again", rotation_add_date: "2026-08-01" }),
      listRow({ rotation_id: 2, artist_name: "Chuquimamani-Condori", album_title: "Edits", rotation_add_date: "2026-08-20" }),
      listRow({ rotation_id: 3, artist_name: "Stereolab", album_title: "Dots and Loops", rotation_add_date: "2026-08-10" }),
    ];

    expect(dedupeRotationListByArtistTitle(rows).map((row) => row.rotation_id)).toEqual([2, 3, 1]);
  });

  it("breaks an identical add-date tie on the lowest rotation id, so the order is deterministic", () => {
    const rows = [
      listRow({ rotation_id: 9, artist_name: "Cat Power", album_title: "Moon Pix", rotation_add_date: "2026-08-05" }),
      listRow({ rotation_id: 4, artist_name: "Juana Molina", album_title: "DOGA", rotation_add_date: "2026-08-05" }),
    ];

    expect(dedupeRotationListByArtistTitle(rows).map((row) => row.rotation_id)).toEqual([4, 9]);
  });

  it("does not collapse a pair whose artist/title split differs but whose concatenation matches", () => {
    const rows = [
      listRow({ rotation_id: 1, artist_name: "Sun", album_title: "Ra Arkestra" }),
      listRow({ rotation_id: 2, artist_name: "Sun Ra", album_title: "Arkestra" }),
    ];

    expect(dedupeRotationListByArtistTitle(rows)).toHaveLength(2);
  });
});
