import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { IntakeItem } from "@wxyc/shared";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

// Every setter `useState` hands out, so the test can assert that none ran after
// unmount (React 19 no longer warns about that, so a silent no-op proves nothing).
const setters = vi.hoisted(() => [] as ReturnType<typeof vi.fn>[]);
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      const [value, set] = actual.useState(initial);
      const spy = vi.fn(set as (...args: unknown[]) => void);
      setters.push(spy);
      return [value, spy];
    }) as unknown as typeof actual.useState,
  };
});

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import RotationReleaseList from "@/src/components/experiences/classic/rotation/RotationReleaseList";

const FILED_DOGA = {
  id: 1,
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  format_id: 1,
  state: "filed",
  effective_state: "filed",
  album_id: 42,
  rotation_id: null,
} as IntakeItem;

const ALBUM = {
  id: 42,
  code_letters: "MOL",
  code_artist_number: 1,
  code_number: 3,
  artist_name: "Juana Molina",
  alphabetical_name: "Molina, Juana",
  album_title: "DOGA",
  record_label: "Sonamos",
  genre_name: "Rock",
  format_name: "CD",
  legacy_release_id: 7001,
};

describe("classic Awaiting Cataloging — filed intake items, unmounted mid-write", () => {
  it("sets no state when the call-number PATCH fails after the page is gone", async () => {
    let failPatch!: () => void;
    const patchHeld = new Promise<void>((resolve) => {
      failPatch = resolve;
    });
    let patchSeen = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get("state") === "filed" ? [FILED_DOGA] : []),
      ),
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/library/rotation/uncatalogued`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/library/formats`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/library/info`, () => HttpResponse.json(ALBUM)),
      http.patch(`${TEST_BACKEND_URL}/library/42`, async () => {
        patchSeen = true;
        await patchHeld;
        return HttpResponse.json({ message: "server words" }, { status: 500 });
      }),
    );
    const { user, unmount } = renderWithProviders(
      <RotationReleaseList statusFilter="uncataloged" canSeeFiled canWrite />,
    );

    await user.click(await screen.findByRole("button", { name: "Change the code: DOGA" }));
    const number = screen.getByLabelText("Call number");
    await user.clear(number);
    await user.type(number, "7");
    await user.click(screen.getByRole("button", { name: "Save and confirm" }));
    await waitFor(() => expect(patchSeen).toBe(true));

    unmount();
    setters.forEach((setter) => setter.mockClear());
    failPatch();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(setters.flatMap((setter) => setter.mock.calls)).toEqual([]);
  });
});
