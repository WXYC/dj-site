import type { PropsWithChildren } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import type { SpecialtyShow } from "@wxyc/shared";
import { specialtyApi } from "@/lib/features/specialty/api";
import { useOneTapPrograms } from "@/src/hooks/specialtyHooks";
import { createTestStore } from "@/tests/helpers/store";
import { server } from "@/tests/fakes/server";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { SEED_CATALOG } from "@/tests/fixtures/specialty";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

// The seed programs are all song-logging; these four log none.
const LOGS_NONE = new Set([2, 3, 9, 10]);
const CATALOG: SpecialtyShow[] = SEED_CATALOG.map((program) => ({
  ...program,
  logs_playcuts: !LOGS_NONE.has(program.id),
}));

const namesAt = async (instant: string, catalog = CATALOG) => {
  vi.setSystemTime(new Date(instant));
  server.use(
    http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(catalog))
  );
  const store = createTestStore();
  await store.dispatch(specialtyApi.endpoints.getSpecialtyShows.initiate());
  const { result } = renderHook(() => useOneTapPrograms(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    ),
  });
  return result.current.map((program) => program.name);
};

describe("useOneTapPrograms", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["Sunday 4:30 PM ET: both shared-slot programs, in catalog order", "2026-10-25T20:30:00Z", ["HyperLocal", "Backyard BBQ"]],
    ["Sunday 3:55 PM ET: inside the ten-minute lead", "2026-10-25T19:55:00Z", ["HyperLocal", "Backyard BBQ"]],
    ["Friday 9:30 PM ET: only the program that logs none, not Inside Track", "2026-10-24T01:30:00Z", ["Story Hour"]],
    ["Friday 10:15 PM ET", "2026-10-24T02:15:00Z", ["New Science Experience"]],
    ["Sunday noon ET: Orange County Special logs songs", "2026-10-25T16:00:00Z", []],
    ["Wednesday 3 PM ET: outside every slot", "2026-10-21T19:00:00Z", []],
  ])("%s", async (_label, instant, expected) => {
    expect(await namesAt(instant)).toEqual(expected);
  });

  it("drops a retired program that logs none", async () => {
    const retired = CATALOG.map((program) =>
      program.id === 2 ? { ...program, active: false } : program
    );
    expect(await namesAt("2026-10-25T20:30:00Z", retired)).toEqual(["Backyard BBQ"]);
  });
});
