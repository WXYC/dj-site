import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { specialtyApi } from "@/lib/features/specialty/api";
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

describe("getSpecialtyShows", () => {
  it("reads the public catalog", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => HttpResponse.json(SEED_CATALOG))
    );

    const result = await createTestStore().dispatch(
      specialtyApi.endpoints.getSpecialtyShows.initiate()
    );

    expect(result.data).toEqual(SEED_CATALOG);
  });

  it("reads an unparseable body as an empty catalog", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/specialty-shows`, () => new HttpResponse("<html>", { status: 200 }))
    );

    const result = await createTestStore().dispatch(
      specialtyApi.endpoints.getSpecialtyShows.initiate()
    );

    expect(result.data).toEqual([]);
  });
});
