import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

// `late` mimics the real hook, which seeds each caller's own state from the session
// alone (no station role yet) and only switches to the resolved role after an effect and a microtask.
const roleState = vi.hoisted(() => ({ late: false }));

vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { useEffect, useState } = await import("react");
  const resolved = {
    data: { user: { id: "md-me", authority: Authorization.MD } },
    authenticating: false,
    authenticated: true,
  };
  const pending = { ...resolved, data: { user: { id: "md-me", authority: Authorization.NO } } };
  return {
    useAuthentication: () => {
      const [settled, setSettled] = useState(!roleState.late);
      useEffect(() => {
        if (settled) return;
        void Promise.resolve().then(() => setSettled(true));
      }, [settled]);
      return settled ? resolved : pending;
    },
  };
});

import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import IntakeLogForm from "@/src/components/experiences/modern/reviews/IntakeLogForm";

const moonPix = (overrides = {}) =>
  intakeItem({ id: 11, artist_name: "Cat Power", album_title: "Moon Pix", record_label: "Matador", ...overrides });

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff"));
afterEach(() => {
  vi.unstubAllEnvs();
  roleState.late = false;
});

type User = ReturnType<typeof renderWithProviders>["user"];

const requestedRow = (id: number) =>
  moonPix({ id, state: "requested", effective_state: "requested", requested_dj_id: "dj-pat", requested_dj_name: "DJ Pat" });
const LOST_CANCEL = "This request was already answered, or it expired. The lists have been reloaded.";

const logMoonPix = async (user: User) => {
  await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
  await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
  await user.click(screen.getByRole("combobox", { name: /^Format/ }));
  await user.click(await screen.findByRole("option", { name: "cd" }));
  await user.click(screen.getByRole("button", { name: "Log item" }));
};

/** Lose a Cancel request race, so the lanes show the lost-race notice. */
const loseACancel = async (user: User) => {
  await user.click(await screen.findByRole("button", { name: "Cancel request" }));
  return screen.findByText(LOST_CANCEL);
};

const fakeLostCancel = () => {
  fakeReviewsEndpoints({ open: [requestedRow(11)] });
  server.use(
    http.post(`${TEST_BACKEND_URL}/intake/11/cancel-request`, () =>
      HttpResponse.json({ message: "server words", reason: "state_changed" }, { status: 409 }),
    ),
    http.post(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json(moonPix())),
  );
};

describe("IntakeLanes props", () => {
  it.each([
    ["neither prop", {}, false, false, false],
    ["logForm", { logForm: true }, true, false, false],
    ["shelf", { shelf: true }, false, true, true],
    ["both", { logForm: true, shelf: true }, true, true, true],
  ])("with %s (props %j): form shown %s, shelf lane shown %s, reviewers read %s", async (_label, props, form, shelf, reviewersRead) => {
    let reviewerReads = 0;
    fakeReviewsEndpoints({ open: [moonPix()] });
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/reviewers`, () => {
        reviewerReads += 1;
        return HttpResponse.json({ reviewers: [] });
      }),
    );

    renderWithProviders(<IntakeLanes {...props} />);

    // The Filed lane renders last, so by then every lane the props allow has landed.
    await screen.findByRole("region", { name: "Filed" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("form", { name: "Log an item" }) !== null).toBe(form);
    expect(screen.queryByRole("region", { name: "On the review shelf" }) !== null).toBe(shelf);
    expect(reviewerReads > 0).toBe(reviewersRead);
  });
});

describe("IntakeLanes hosting the logging form", () => {
  it("never paints the lanes without the form when the role resolves after the first paint", async () => {
    roleState.late = true;
    fakeReviewsEndpoints({ open: [moonPix()] });
    const states: string[] = [];
    const observer = new MutationObserver(() => {
      const lanes = screen.queryByRole("region", { name: "Filed" }) !== null;
      const form = screen.queryByRole("form", { name: "Log an item" }) !== null;
      states.push(`${lanes ? "L" : "-"}${form ? "F" : "-"}`);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    renderWithProviders(<IntakeLanes logForm />);
    await screen.findByRole("form", { name: "Log an item" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    observer.disconnect();

    expect(states).toContain("LF");
    expect(states).not.toContain("L-");
  });

  it("clears the lost-race notice once a record is logged", async () => {
    fakeLostCancel();
    const { user } = renderWithProviders(<IntakeLanes logForm />);
    expect(await loseACancel(user)).toBeInTheDocument();

    await logMoonPix(user);

    await waitFor(() => expect(screen.queryByText(LOST_CANCEL)).not.toBeInTheDocument());
  });

  it("puts the logging form above the lost-race notice", async () => {
    fakeLostCancel();
    const { user } = renderWithProviders(<IntakeLanes logForm />);
    const notice = await loseACancel(user);

    const form = screen.getByRole("form", { name: "Log an item" });
    expect(form.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("IntakeLogForm", () => {
  it("calls onLog before the request goes out, then logs the typed fields", async () => {
    const order: string[] = [];
    let body: unknown;
    fakeReviewsEndpoints();
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        order.push("request");
        body = await request.json();
        return HttpResponse.json(moonPix());
      }),
    );

    const { user } = renderWithProviders(<IntakeLogForm onLog={() => order.push("onLog")} />);
    await user.type(await screen.findByLabelText(/^Artist/), "Cat Power");
    await user.type(screen.getByLabelText(/^Album/), "Moon Pix");
    await user.click(screen.getByRole("combobox", { name: /^Format/ }));
    await user.click(await screen.findByRole("option", { name: "cd" }));
    await user.type(screen.getByLabelText("Discogs release id (optional)"), "123");
    await user.click(screen.getByRole("button", { name: "Log item" }));

    await waitFor(() =>
      expect(body).toEqual({ artist_name: "Cat Power", album_title: "Moon Pix", format_id: 1, discogs_release_id: 123 }),
    );
    expect(order).toEqual(["onLog", "request"]);
  });
});
