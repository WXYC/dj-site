import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  CHARSET_TORTURE_ENTRIES,
  charsetEntryId,
} from "@/lib/test-utils/charset-torture";

const ECHO_URL = "https://test.local/echo";

const server = setupServer(
  http.post(ECHO_URL, async ({ request }) => {
    const body = (await request.json()) as { value: string };
    return HttpResponse.json({ value: body.value });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("charset-torture: msw-mocked Backend round-trip", () => {
  it.each(
    CHARSET_TORTURE_ENTRIES.map(
      (entry) => [charsetEntryId(entry), entry] as const
    )
  )("preserves %s through fetch POST + msw echo", async (_id, entry) => {
    const res = await fetch(ECHO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: entry.input }),
    });
    const body = (await res.json()) as { value: string };
    expect(body.value).toBe(entry.input);
  });
});

describe("charset-torture: JSON.stringify/parse codec", () => {
  it.each(
    CHARSET_TORTURE_ENTRIES.map(
      (entry) => [charsetEntryId(entry), entry] as const
    )
  )(
    "preserves %s through JSON.stringify -> JSON.parse",
    (_id, entry) => {
      const restored = JSON.parse(JSON.stringify({ value: entry.input }));
      expect(restored.value).toBe(entry.input);
    }
  );
});

describe("charset-torture: URLSearchParams round-trip", () => {
  it.each(
    CHARSET_TORTURE_ENTRIES.map(
      (entry) => [charsetEntryId(entry), entry] as const
    )
  )("preserves %s as a URL query value", (_id, entry) => {
    const url = new URL("https://test.local/search");
    url.searchParams.set("artist_name", entry.input);
    const parsed = new URL(url.toString());
    expect(parsed.searchParams.get("artist_name")).toBe(entry.input);
  });
});
