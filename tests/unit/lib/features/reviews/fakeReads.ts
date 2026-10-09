import type { AlbumReview } from "@wxyc/shared";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

/** GETs `route` + `search` from the fake backend and reads the rows' ids. */
export const readIds = async (route: string, search: string) => {
  const rows = (await (await fetch(`${TEST_BACKEND_URL}${route}${search}`)).json()) as { id: number }[];
  return rows.map((row) => row.id);
};

/** GETs `/album-reviews` + `search` and reads the page's `album_reviews` ids. */
export const readAlbumReviewIds = async (search: string) => {
  const page = (await (await fetch(`${TEST_BACKEND_URL}/album-reviews${search}`)).json()) as {
    album_reviews: Pick<AlbumReview, "id">[];
  };
  return page.album_reviews.map((row) => row.id);
};
