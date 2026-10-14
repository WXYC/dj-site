import { describe, it, expect } from "vitest";
import type { AlbumReview } from "@wxyc/shared";
import { fakeAlbumReviewEndpoints } from "@/tests/fakes/reviews/albumReview";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { readAlbumReviewIds } from "./fakeReads";

const albumReview = (id: number, albumId: number) => ({ id, album_id: albumId }) as unknown as AlbumReview;

describe("fakeAlbumReviewEndpoints GET /album-reviews", () => {
  it.each<[string, string, number[]]>([
    ["an album_id with rows answers exactly those rows", "?album_id=5", [1, 2]],
    ["another album_id answers its own rows, not the first one's", "?album_id=6", [3]],
    ["an album_id with no row answers an empty page", "?album_id=99", []],
    ["no album_id answers an empty page, not every archive row", "", []],
  ])("%s", async (_name, search, expectedIds) => {
    fakeAlbumReviewEndpoints({ archive: { "5": [albumReview(1, 5), albumReview(2, 5)], "6": [albumReview(3, 6)] } });

    expect(await readAlbumReviewIds(search)).toEqual(expectedIds);
  });

  it.each<[string, string, number[]]>([
    ["an artist answers that artist's rows, not the album archive's", "?artist=Jessica%20Pratt", [10, 11]],
    ["another artist answers its own rows", "?artist=Stereolab", [12]],
    ["capitals and a leading The don't matter, as on the server", "?artist=the%20JESSICA%20pratt", [10, 11]],
    ["an artist with no row answers an empty page", "?artist=Cat%20Power", []],
  ])("%s", async (_name, search, expectedIds) => {
    fakeAlbumReviewEndpoints({
      archive: { "5": [albumReview(1, 5)] },
      byArtist: { "Jessica Pratt": [albumReview(10, 7), albumReview(11, 8)], Stereolab: [albumReview(12, 9)] },
    });

    expect(await readAlbumReviewIds(search)).toEqual(expectedIds);
  });

  it("answers the archive page shape, with an empty pagination object", async () => {
    fakeAlbumReviewEndpoints({ archive: { "5": [albumReview(1, 5)] } });

    const page = await (await fetch(`${TEST_BACKEND_URL}/album-reviews?album_id=5`)).json();

    expect(page).toEqual({ album_reviews: [albumReview(1, 5)], pagination: {} });
  });
});
