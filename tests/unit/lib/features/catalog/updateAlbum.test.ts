import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";
import { interpretReleaseSaveError } from "@/lib/features/catalog/releaseSaveOutcome";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const { mockCaptureException } = vi.hoisted(() => ({ mockCaptureException: vi.fn() }));
vi.mock("@/lib/error-reporting", () => ({
  safeCaptureException: mockCaptureException,
}));

import { toast } from "sonner";

const mockToastError = toast.error as ReturnType<typeof vi.fn>;

const SLOT_TAKEN = {
  status: 409,
  body: { message: "Call number 135 is already taken for artist 1087 in genre 4", code: "library_slot_conflict" },
};
const NOT_IN_GENRE = { status: 400, body: { message: "Artist is not catalogued in the selected genre" } };

function answerPatch(status: number, body: { message: string; code?: string }) {
  server.use(http.patch(`${TEST_BACKEND_URL}/library/4242`, () => HttpResponse.json(body, { status })));
}

async function saveGenre() {
  const store = createTestStore();
  const result = await store.dispatch(
    catalogApi.endpoints.updateAlbum.initiate({ albumId: 4242, body: { genre_id: 4 } }),
  );
  return "error" in result ? result.error : undefined;
}

describe("updateAlbum refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Every screen that can trigger these words them itself, so the shared
  // middleware must neither repeat the raw server text (which names internal
  // ids) nor report a normal librarian outcome as a fault.
  it.each([
    { label: "a taken call number", ...SLOT_TAKEN },
    { label: "an artist not filed in the genre", ...NOT_IN_GENRE },
  ])("leaves $label to the screen", async ({ status, body }) => {
    answerPatch(status, body);

    const error = await saveGenre();

    expect(error).toBeTruthy();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("still hands a refusal to the interpreter in the shape it reads", async () => {
    answerPatch(SLOT_TAKEN.status, SLOT_TAKEN.body);

    const error = await saveGenre();

    expect(
      interpretReleaseSaveError(error, {
        screen: "editor",
        genreName: "Electronic",
        callNumber: "135",
        artistName: "Various Artists",
        variousArtists: true,
      }).reason,
    ).toBe("slot_taken");
  });

  it.each([
    { label: "a 409 with another code", status: 409, body: { message: "Conflict", code: "something_else" } },
    { label: "a 400 with another message", status: 400, body: { message: "album_title is required" } },
    { label: "a server error", status: 500, body: { message: "boom" } },
  ])("still toasts and reports $label", async ({ status, body }) => {
    answerPatch(status, body);

    await saveGenre();

    expect(mockToastError).toHaveBeenCalledWith(body.message);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
