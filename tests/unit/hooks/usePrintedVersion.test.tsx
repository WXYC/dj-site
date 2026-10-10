import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import { Authorization } from "@/lib/features/admin/types";
import { review, reviewRevision, server } from "@/tests/helpers";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({
    data: { user: { id: "dj-me", authority: Authorization.DJ } },
    authenticating: false,
    authenticated: true,
  }),
}));

import {
  usePrintedVersion,
  type PrintedVersion,
} from "@/src/components/experiences/modern/reviews/usePrintedVersion";

const first = reviewRevision({ id: 101, revision: 1 });
const second = reviewRevision({ id: 102, revision: 2 });
const printed = (overrides = {}) =>
  review({ id: 40, status: "submitted", printed_revision_id: 101, printed_at: "2026-10-02T16:00:00Z", ...overrides });

type Row = {
  name: string;
  onCover: boolean;
  review: ReturnType<typeof printed>;
  reply: { status: number } | { revisions: ReturnType<typeof reviewRevision>[] } | "hold";
  expected: PrintedVersion;
  requested: boolean;
};

const rows: Row[] = [
  { name: "not on this cover", onCover: false, review: printed(), reply: { revisions: [second, first] }, expected: "none", requested: false },
  { name: "never printed", onCover: true, review: printed({ printed_revision_id: null, printed_at: null }), reply: { revisions: [first] }, expected: "none", requested: false },
  { name: "revisions loading", onCover: true, review: printed(), reply: "hold", expected: "loading", requested: true },
  { name: "revisions failing", onCover: true, review: printed(), reply: { status: 500 }, expected: "failed", requested: true },
  { name: "newest revision is the printed one", onCover: true, review: printed(), reply: { revisions: [first] }, expected: "current", requested: true },
  { name: "newest differs", onCover: true, review: printed(), reply: { revisions: [first, second] }, expected: "edited", requested: true },
  { name: "newest differs but printed_at is unparseable", onCover: true, review: printed({ printed_at: "not a date" }), reply: { revisions: [first, second] }, expected: "none", requested: true },
];

describe("usePrintedVersion", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "true");
  });

  it.each(rows)("$name", async ({ onCover, review: r, reply, expected, requested }) => {
    const seen: string[] = [];
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/${r.id}/revisions`, async () => {
        seen.push("revisions");
        if (reply === "hold") return new Promise<never>(() => {});
        if ("status" in reply) return HttpResponse.json({ message: null }, { status: reply.status });
        return HttpResponse.json(reply.revisions);
      }),
    );
    const store = makeStore();
    const { result } = renderHook(() => usePrintedVersion(r, { onCover }), {
      wrapper: ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>,
    });

    if (expected === "loading" || expected === "none") {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await waitFor(() => expect(result.current).toBe(expected));
    expect(seen.length > 0).toBe(requested);
  });
});
