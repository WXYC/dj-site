import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";
import { isAddArtistConflict } from "@/lib/features/catalog/adminCreateArtistValidation";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const ARTIST_ID = 42;

describe("updateArtistCard", () => {
  it("strips the generic message from a rename-collision 409, leaving the named artist", async () => {
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json(
          {
            message: "Artist name already exists in one of this artist's genres.",
            artist: { artist_id: 99, artist_name: "Jessica Pratt", code_letters: "PR" },
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.updateArtistCard.initiate({
        artistId: ARTIST_ID,
        body: { artist_name: "Jessica Pratt", alphabetical_name: "Molina, Juana" },
      }),
    );
    const error = "error" in result ? result.error : undefined;

    // Stripping `message` is what keeps the shared rtk-query-error-logger
    // from toasting the same refusal a second time -- the artist card states
    // it itself, inline, by name.
    expect(isAddArtistConflict(error)).toBe(true);
    if (isAddArtistConflict(error)) {
      expect(error.data).not.toHaveProperty("message");
      expect(error.data.artist.artist_name).toBe("Jessica Pratt");
    }
  });
});
