import { describe, it, expect, vi } from "vitest";
import type { RotationRowSummary } from "@wxyc/shared/dtos";
import { runRotationImport, type ImportChainDeps, type ImportRequest } from "@/lib/features/rotation/importSubmit";
import { RotationBin } from "@/lib/features/rotation/types";

const UNLINKED: RotationRowSummary = {
  id: 6002,
  album_id: null,
  rotation_bin: RotationBin.L,
  add_date: "2026-01-10",
  kill_date: "2026-02-01",
  artist_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  format_id: 3,
  label_id: null,
};

function deps(overrides: Partial<ImportChainDeps> = {}): ImportChainDeps {
  return {
    readRotationRow: vi.fn(async () => UNLINKED),
    createArtist: vi.fn(async () => ({ id: 771 })),
    createAlbum: vi.fn(async () => ({ id: 8801, code_number: 4, code_volume_letters: null })),
    ...overrides,
  };
}

const existingArtistRequest: ImportRequest = {
  rotationId: 6002,
  artistName: "Chuquimamani-Condori",
  albumTitle: "Edits",
  artistId: 771,
  codeLetters: "CHU",
  album: { label: "self-released", genre_id: 5, format_id: 3 },
};

const newArtistRequest: ImportRequest = {
  rotationId: 6002,
  artistName: "Chuquimamani-Condori",
  albumTitle: "Edits",
  codeLetters: "CHU",
  newArtist: {
    artist_name: "Chuquimamani-Condori",
    alphabetical_name: "Chuquimamani-Condori",
    code_letters: "CHU",
    genre_id: 5,
    code_number: 12,
  },
  album: { label: "self-released", genre_id: 5, format_id: 3 },
};

describe("runRotationImport — the existing-artist chain", () => {
  it("re-reads, then creates the release, in that order", async () => {
    const order: string[] = [];
    const d = deps({
      readRotationRow: vi.fn(async () => {
        order.push("read");
        return UNLINKED;
      }),
      createAlbum: vi.fn(async () => {
        order.push("create");
        return { id: 8801, code_number: 4 };
      }),
    });

    const outcome = await runRotationImport(existingArtistRequest, d);

    expect(order).toEqual(["read", "create"]);
    expect(outcome).toMatchObject({ kind: "linked", artistId: 771, codeLetters: "CHU", codeNumber: 4 });
  });

  it("sends the artist and title alongside the release fields the form collected", async () => {
    const createAlbum = vi.fn(async () => ({ id: 8801 }));
    await runRotationImport(existingArtistRequest, deps({ createAlbum }));

    expect(createAlbum).toHaveBeenCalledWith({
      artist_id: 771,
      album_title: "Edits",
      from_rotation_id: 6002,
      label: "self-released",
      genre_id: 5,
      format_id: 3,
    });
  });
});

describe("runRotationImport — the staleness check", () => {
  // A tab left open while the row was catalogued elsewhere would otherwise
  // mint a second library release for the same record.
  it("refuses before creating anything when the row has been linked meanwhile", async () => {
    const d = deps({ readRotationRow: vi.fn(async () => ({ ...UNLINKED, album_id: 42 })) });

    expect(await runRotationImport(existingArtistRequest, d)).toEqual({ kind: "stale" });
    expect(d.createAlbum).not.toHaveBeenCalled();
    expect(d.createArtist).not.toHaveBeenCalled();
  });

  // Not knowing whether the row is linked is not the same as knowing it is
  // not, so a failed re-read must not fall through into the create.
  it("creates nothing when the re-read itself fails", async () => {
    const d = deps({
      readRotationRow: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    expect(await runRotationImport(existingArtistRequest, d)).toMatchObject({ kind: "unchecked" });
    expect(d.createAlbum).not.toHaveBeenCalled();
  });
});

describe("runRotationImport — the new-artist chain", () => {
  it("creates the artist, then the release under it", async () => {
    const d = deps();
    const outcome = await runRotationImport(newArtistRequest, d);

    expect(d.createArtist).toHaveBeenCalledWith(newArtistRequest.newArtist);
    expect(d.createAlbum).toHaveBeenCalledWith(expect.objectContaining({ artist_id: 771, from_rotation_id: 6002 }));
    expect(outcome).toMatchObject({ kind: "linked", artistId: 771 });
  });

  it("stops at a failed artist create, having created nothing else", async () => {
    const d = deps({
      createArtist: vi.fn(async () => {
        throw { status: 409, data: { artist: { artist_id: 5, artist_name: "Cat Power" } } };
      }),
    });

    expect(await runRotationImport(newArtistRequest, d)).toMatchObject({ kind: "artist-failed" });
    expect(d.createAlbum).not.toHaveBeenCalled();
  });

  // The middle failure: the artist is on record and the release is not, which
  // the caller has to say rather than reporting a plain "failed".
  it("reports a failed release create and names the artist it already created", async () => {
    const d = deps({
      createAlbum: vi.fn(async () => {
        throw { status: 400, data: { message: "Missing Parameters: format_id" } };
      }),
    });

    expect(await runRotationImport(newArtistRequest, d)).toMatchObject({
      kind: "album-failed",
      artistId: 771,
      createdArtist: true,
    });
  });

  it("does not claim to have created an artist on the existing-artist branch", async () => {
    const d = deps({
      createAlbum: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    expect(await runRotationImport(existingArtistRequest, d)).toMatchObject({
      kind: "album-failed",
      createdArtist: false,
    });
  });
});
