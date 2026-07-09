import { test, expect, Browser } from "@playwright/test";
import path from "path";
import { LoginPage } from "../../pages/login.page";
import {
  approveDeviceCode,
  claimDeviceCode,
  denyDeviceCode,
} from "../../helpers/device-auth";

/**
 * RFC 8628 QR ("device authorization") sign-in — the two-context golden path
 * and its negative branches (ADR 0005 / #785; follow-up to PR 2 #838).
 *
 * The flow is inherently two-context: the shared control-room browser
 * (Context A, unauthenticated) requests a device code and polls
 * `/auth/device/token`, while a *separate* authenticated principal (Context B,
 * the "phone") claims the user code and approves or denies it. That split
 * can't be exercised by the single-page component/hook specs, so it lives here.
 *
 * Context B reuses a saved `storageState` (no interactive login) and talks to
 * the auth service directly, cross-origin — the session cookie is
 * `domain=localhost` (port-agnostic), so it attaches to the auth-service port
 * regardless of which frontend port minted it. We use `dj2.json`, not
 * `dj.json` (the logout specs invalidate `dj.json` server-side — see
 * `e2e/tests/auth/logout.spec.ts`).
 *
 * Requires the build-time flag `NEXT_PUBLIC_QR_LOGIN_ENABLED` (set in
 * `e2e-tests.yml` and `scripts/e2e-local.sh`); without it the entry link never
 * renders. No DB cleanup: each `/device/code` mints a unique `user_code` with a
 * 300s TTL, so leftover rows can't collide across tests — serial mode alone
 * keeps the flow deterministic.
 */

const authDir = path.join(__dirname, "..", "..", ".auth");
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
/** The "phone" DJ principal. dj2.json (not dj.json — logout specs kill that). */
const DJ_STORAGE = path.join(authDir, "dj2.json");
/** An authenticated account with no DJ org-role — the `access_denied` case. */
const MEMBER_STORAGE = path.join(authDir, "member.json");

/**
 * The shared browser reaches the dashboard only after a poll interval (≥5s) +
 * the post-sign-in `confirmSessionVisible` reads, and a `slow_down` backoff can
 * add another interval — so give the redirect a generous ceiling (well under
 * the 60s per-test budget).
 */
const DASHBOARD_REDIRECT_TIMEOUT_MS = 45_000;

/**
 * Drive Context A — an unauthenticated shared browser — to the QR waiting
 * state, then run `body` with its {@link LoginPage} and the freshly-minted
 * `user_code` (captured from the `POST /auth/device/code` response, which
 * lands before the code renders). Owns the context lifecycle: the context is
 * always closed, even if `startQrLogin` or `body` throws.
 */
async function withSharedBrowserQr(
  browser: Browser,
  body: (ctx: { loginPage: LoginPage; userCode: string }) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  try {
    const page = await context.newPage();
    const loginPage = new LoginPage(page);
    const codeResponse = page.waitForResponse(
      (r) =>
        /\/device\/code\b/.test(r.url()) &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 20_000 },
    );
    // Pre-attach a no-op rejection handler: if a later step throws before we
    // await this, the `finally` closing the context rejects it — without this
    // that would surface as an unhandled rejection.
    void codeResponse.catch(() => {});

    await loginPage.goto();
    await loginPage.startQrLogin();

    const parsed = (await (await codeResponse).json()) as { user_code?: string };
    expect(typeof parsed.user_code).toBe("string");
    await body({ loginPage, userCode: parsed.user_code as string });
  } finally {
    await context.close();
  }
}

/** A DJ (dj2.json) claims + approves the code on a separate "phone" context. */
async function djApprovesOnPhone(browser: Browser, userCode: string): Promise<void> {
  const phone = await browser.newContext({ storageState: DJ_STORAGE });
  try {
    expect((await claimDeviceCode(phone.request, userCode)).status()).toBe(200);
    expect((await approveDeviceCode(phone.request, userCode)).status()).toBe(200);
  } finally {
    await phone.close();
  }
}

/** A DJ (dj2.json) claims + denies the code on a separate "phone" context. */
async function djDeniesOnPhone(browser: Browser, userCode: string): Promise<void> {
  const phone = await browser.newContext({ storageState: DJ_STORAGE });
  try {
    expect((await claimDeviceCode(phone.request, userCode)).status()).toBe(200);
    expect((await denyDeviceCode(phone.request, userCode)).status()).toBe(200);
  } finally {
    await phone.close();
  }
}

test.describe("QR sign-in (RFC 8628 device authorization)", () => {
  // Independent per test (fresh contexts, unique codes), but kept serial for
  // determinism and to avoid piling concurrent device flows on the auth service.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    // Golden path pays a poll interval (≥5s) + the post-sign-in session-confirm
    // reads before navigating — well over the 20s default on a loaded CI runner.
    test.setTimeout(60_000);
  });

  test("golden path: a DJ approving on their phone signs the shared browser in", async ({
    browser,
  }) => {
    await withSharedBrowserQr(browser, async ({ loginPage, userCode }) => {
      await expect(loginPage.qrScanHeading).toBeVisible();

      await djApprovesOnPhone(browser, userCode);

      // The shared browser's next 200 poll confirms the session, then navigates.
      await loginPage.waitForRedirectToDashboard(DASHBOARD_REDIRECT_TIMEOUT_MS);
    });
  });

  test("deny path: a DJ denying on their phone surfaces the denied state with a password fallback", async ({
    browser,
  }) => {
    await withSharedBrowserQr(browser, async ({ loginPage, userCode }) => {
      await djDeniesOnPhone(browser, userCode);

      // `/device/deny` flips the row to a terminal `denied`, so the browser's
      // next poll returns `access_denied` and QRCodeForm shows the denied state.
      await expect(loginPage.qrDeniedHeading).toBeVisible({ timeout: 30_000 });
      await expect(loginPage.qrPasswordFallbackLink).toBeVisible();
      expect(loginPage.page.url()).toContain("/login");
    });
  });

  test("a non-DJ approval is rejected phone-side and cannot sign the shared browser in; a DJ can still approve the same code", async ({
    browser,
  }) => {
    await withSharedBrowserQr(browser, async ({ loginPage, userCode }) => {
      // Phone 1 — a `member` (authenticated, no DJ role). The claim succeeds,
      // but Backend-Service's role gate rejects the approve with a 403
      // `access_denied` *before* flipping the row, and un-claims it so a real DJ
      // can still approve the same code. This is the S1 contract in
      // Backend-Service/shared/authentication/src/device-authorization.ts and
      // its integration spec — the rejection is phone-side only; the browser is
      // NOT sent to the denied state (that is reserved for an explicit deny).
      const memberPhone = await browser.newContext({ storageState: MEMBER_STORAGE });
      try {
        expect((await claimDeviceCode(memberPhone.request, userCode)).status()).toBe(200);
        const rejected = await approveDeviceCode(memberPhone.request, userCode);
        expect(rejected.status()).toBe(403);
        expect((await rejected.json())?.error).toBe("access_denied");
      } finally {
        await memberPhone.close();
      }

      // The browser is unaffected: its next poll returns a non-terminal "keep
      // waiting" state, NOT `access_denied`, so it stays on /login in the
      // waiting state. Accept both `authorization_pending` and `slow_down` —
      // the plugin returns `slow_down` for any poll landing <5s after the prior
      // (the client polls on a 5s timer), so pinning the exact code would flake.
      const poll = await loginPage.page.waitForResponse(
        (r) => /\/device\/token\b/.test(r.url()) && r.request().method() === "POST",
        { timeout: 20_000 },
      );
      expect(["authorization_pending", "slow_down"]).toContain((await poll.json())?.error);
      await expect(loginPage.qrDeniedHeading).toBeHidden();
      expect(loginPage.page.url()).toContain("/login");

      // Phone 2 — a DJ approves the same still-live code; the browser signs in.
      await djApprovesOnPhone(browser, userCode);

      await loginPage.waitForRedirectToDashboard(DASHBOARD_REDIRECT_TIMEOUT_MS);
    });
  });
});
