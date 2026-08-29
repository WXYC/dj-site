import type { BrowserContext, Page } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
// The repo's extended `test`, not `@playwright/test`'s, so a guard added to the
// shared one later (a console-error assertion, a per-test cleanup) covers this
// file too. Its extra fixtures go unused here; that costs nothing.
import { test, expect, TAKEOVER_DJ_A, TAKEOVER_DJ_B } from "../../fixtures/auth.fixture";

const authDir = path.join(__dirname, "../../.auth");
const MOCK_TUBAFRENZY_URL = process.env.MOCK_TUBAFRENZY_URL || "http://localhost:9091";

/**
 * Go-live takeover: two DJs, one open show, and the decision a DJ makes when
 * they collide.
 *
 * This file is deliberately the only place in the suite that clicks "End
 * Existing Show". `e2e/pages/flowsheet.page.ts`'s shared
 * `answerHandoffPromptIfShown` always clicks "Join Existing Show" and must
 * never be taught to take over: within a shard, two Playwright workers share
 * one Backend-Service, so a takeover from the shared page object would end a
 * sibling worker's show mid-test. This spec avoids that by owning its own
 * Backend-Service in its own workflow job (see .github/workflows/e2e-tests.yml's
 * `e2e-takeover` job) and its own dedicated pair of sessions
 * (TAKEOVER_DJ_A / TAKEOVER_DJ_B, provisioned in e2e/auth.setup.ts) — nothing
 * else in the suite runs against this Backend or these accounts.
 *
 * Also depends on `FLOWSHEET_TAKEOVER_ENABLED=true` reaching that
 * Backend-Service process. Without it, the prompt in beat 2 still renders —
 * the client-side pre-check that opens it (`useOpenShowHandoff`) never asks
 * the server — but the server ignores `intent` entirely and co-hosts, so
 * beats 3-5 would exercise nothing. Beat 3 asserts the response shape that
 * only a flag-on server can produce, which is this spec's proof the flag
 * actually reached the running process rather than just the checked-in .env.
 */
test.describe("Go-live takeover", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;
  let flowsheetA: FlowsheetPage;
  let flowsheetB: FlowsheetPage;
  /**
   * Highest mirror-request id the mock had already assigned when this attempt
   * started. Beat 5 searches only past it.
   *
   * The mock's buffer is process-global and outlives a Playwright retry, while
   * `mode: "serial"` re-runs every beat on retry. Without a watermark, beat 5's
   * `find` would happily match the *previous* attempt's create and signoff and
   * pass on evidence this attempt never produced.
   */
  let mirrorWatermark = 0;

  test.beforeAll(async ({ browser }) => {
    // Hook timeouts are their own budget — a suite-scoped `test.setTimeout`
    // governs the tests, not this. Two `goto` + `waitForEntriesLoaded` pairs
    // and two `ensureOffAir` calls (which fall through to `leave` when a stale
    // local database left a DJ live) can outrun the config's 20s default.
    test.setTimeout(90_000);
    const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    contextA = await browser.newContext({
      baseURL,
      storageState: path.join(authDir, TAKEOVER_DJ_A.stateFile),
    });
    contextB = await browser.newContext({
      baseURL,
      storageState: path.join(authDir, TAKEOVER_DJ_B.stateFile),
    });
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();
    flowsheetA = new FlowsheetPage(pageA);
    flowsheetB = new FlowsheetPage(pageB);

    await flowsheetA.goto();
    await flowsheetA.waitForEntriesLoaded();
    await flowsheetB.goto();
    await flowsheetB.waitForEntriesLoaded();

    // This job's Backend-Service is freshly initialized per CI run, but a
    // local rerun against a stale DB could leave either DJ live from a
    // previous attempt.
    await flowsheetA.ensureOffAir();
    await flowsheetB.ensureOffAir();

    // Read the watermark last: the sign-offs `ensureOffAir` may just have sent
    // belong to whatever ran before this attempt, not to it.
    const seen = await pageA.request.get(`${MOCK_TUBAFRENZY_URL}/__requests`);
    const priorRequests = seen.ok() ? ((await seen.json()) as MirrorRequest[]) : [];
    mirrorWatermark = priorRequests.reduce((max, r) => Math.max(max, r.id), 0);
  });

  test.afterAll(async () => {
    await contextA?.close().catch(() => {});
    await contextB?.close().catch(() => {});
  });

  test("1. DJ A goes live and the banner names only A", async () => {
    await goLiveNoCollision(flowsheetA);

    const state = await fetchLiveState(flowsheetA);
    expect(state.djsOnAir.map((dj) => dj.dj_name)).toEqual([TAKEOVER_DJ_A.djName]);
    expect(state.onAir?.dj_name).toBe(TAKEOVER_DJ_A.djName);
  });

  test("2. DJ B pressing Go Live sees the prompt naming A", async () => {
    // Refetch B's own view before pressing so the client-side pre-check
    // (useOpenShowHandoff) has a chance to see A's show without a round
    // trip. Not load-bearing for the prompt itself — the server's 409
    // backstop opens the identical prompt — only for which of the two paths
    // this run happens to exercise.
    await flowsheetB.goto();
    await flowsheetB.waitForEntriesLoaded();

    await expect(flowsheetB.goLiveButton).toBeEnabled({ timeout: 10000 });
    await flowsheetB.goLiveButton.click();

    const dialog = pageB.getByTestId("go-live-handoff-dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog).toContainText(TAKEOVER_DJ_A.djName);
  });

  test("3. B ends A's show and takes over", async () => {
    const decision = await decideHandoff(flowsheetB, "go-live-handoff-takeover");

    expect(decision.ok).toBe(true);
    expect(decision.intent).toBe("takeover");
    expect(typeof decision.expectedShowId).toBe("number");
    // The load-bearing assertion for "the flag reached the server": with
    // FLOWSHEET_TAKEOVER_ENABLED off, the route ignores `intent` altogether
    // and co-hosts, answering with a ShowDJ (`show_id`/`dj_id`, never a
    // numeric `id`) — see lib/features/flowsheet/go-live-handoff.ts's
    // takeoverWasHonored. A numeric `id` that differs from the
    // `expected_show_id` this request sent is only possible when the server
    // actually closed A's show and opened a new one for B.
    expect(typeof decision.body.id).toBe("number");
    expect(decision.body.id).not.toBe(decision.expectedShowId);

    await expect(flowsheetB.liveStatus).toContainText("On Air", { timeout: 10000 });

    await flowsheetA.goto();
    await flowsheetA.waitForEntriesLoaded();
    await expect(flowsheetA.liveStatus).toContainText("Off Air", { timeout: 10000 });

    const state = await fetchLiveState(flowsheetB);
    expect(state.djsOnAir.map((dj) => dj.dj_name)).toEqual([TAKEOVER_DJ_B.djName]);
    expect(state.onAir?.dj_name).toBe(TAKEOVER_DJ_B.djName);
  });

  test("4. B joins as co-host instead; banner shows both, A remains primary", async () => {
    // Fresh collision: B signs off the show it took over, A starts a new
    // one, and this time B answers "Join Existing Show".
    await flowsheetB.leave();
    await goLiveNoCollision(flowsheetA);

    await flowsheetB.goto();
    await flowsheetB.waitForEntriesLoaded();
    await expect(flowsheetB.goLiveButton).toBeEnabled({ timeout: 10000 });
    await flowsheetB.goLiveButton.click();
    const dialog = pageB.getByTestId("go-live-handoff-dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });

    const decision = await decideHandoff(flowsheetB, "go-live-handoff-join");
    expect(decision.ok).toBe(true);
    expect(decision.intent).toBe("join");
    // A co-host join lands on the show it named rather than starting a new
    // one, so its response is the ShowDJ shape — no numeric `id` (mirrors
    // the inverse check in beat 3).
    expect(typeof decision.body.id).not.toBe("number");

    await expect(flowsheetB.liveStatus).toContainText("On Air", { timeout: 10000 });

    const state = await fetchLiveState(flowsheetB);
    expect(state.djsOnAir.map((dj) => dj.dj_name).sort()).toEqual(
      [TAKEOVER_DJ_A.djName, TAKEOVER_DJ_B.djName].sort()
    );
    // A started the show B joined, so A stays the primary DJ the banner
    // names — a co-host join must not reassign it.
    expect(state.onAir?.dj_name).toBe(TAKEOVER_DJ_A.djName);
  });

  test("5. the tubafrenzy mirror signs A's show off and creates B's — targeting, not sequence", async () => {
    // Ordering across the two mirror taps is unenforceable: the route
    // registers the start tap's `res.once('finish')` before the controller
    // runs, and both taps then await independent PostHog round-trips before
    // reaching the mock. This waits for the mock to have SEEN both, and
    // checks which show each request named — never their relative order.
    await expect(async () => {
      const response = await pageA.request.get(`${MOCK_TUBAFRENZY_URL}/__requests`);
      expect(response.ok()).toBe(true);
      const requests = ((await response.json()) as MirrorRequest[]).filter(
        (r) => r.id > mirrorWatermark
      );

      const aCreate = requests.find(
        (r) =>
          r.url === "/playlists/api/radioShow" &&
          isRecord(r.body) &&
          r.body.djHandle === TAKEOVER_DJ_A.djName
      );
      expect(aCreate, "mock never saw a create request for A's show").toBeTruthy();

      const bCreate = requests.find(
        (r) =>
          r.url === "/playlists/api/radioShow" &&
          isRecord(r.body) &&
          r.body.djHandle === TAKEOVER_DJ_B.djName
      );
      expect(bCreate, "mock never saw a create request for B's show").toBeTruthy();

      // Targeting: a sign-off whose radioShowId is the tubafrenzy id THIS
      // MOCK assigned to A's create — not merely "a signoff happened".
      const aSignoff = requests.find(
        (r) =>
          r.url === "/playlists/api/radioShow/signoff" &&
          isRecord(r.body) &&
          r.body.radioShowId === aCreate!.id
      );
      expect(
        aSignoff,
        "mock never saw a signoff targeting the tubafrenzy id it assigned A's show"
      ).toBeTruthy();
    }).toPass({ timeout: 15000, intervals: [500] });
  });

  test("6. regression guard: a clean handoff still needs no prompt", async () => {
    await flowsheetB.leave();
    await flowsheetA.leave();
    await expect(flowsheetA.liveStatus).toContainText("Off Air", { timeout: 10000 });

    await flowsheetB.goto();
    await flowsheetB.waitForEntriesLoaded();
    await expect(flowsheetB.goLiveButton).toBeEnabled({ timeout: 10000 });
    await flowsheetB.goLiveButton.click();

    // No open show to collide with, so the ordinary one-click path must
    // stay one click — this is the regression guard for the incident this
    // whole feature exists to fix.
    await expect(pageB.getByTestId("go-live-handoff-dialog")).not.toBeVisible({
      timeout: 3000,
    });
    await expect(flowsheetB.liveStatus).toContainText("On Air", { timeout: 10000 });

    await flowsheetB.leave();
  });
});

type RawOnAirDj = { id: string | null; dj_name: string };

type LiveState = {
  djsOnAir: RawOnAirDj[];
  onAir: { dj_name: string } | null;
};

type MirrorRequest = {
  method: string;
  url: string;
  body: unknown;
  id: number;
  timestamp: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Click Go Live and require it to succeed with no handoff — a defensive
 * check that the scenario each test sets up really is collision-free, not
 * merely a click that this helper hides a prompt behind.
 *
 * Reloads first. `useOpenShowHandoff`'s pre-check reads whoever this page's
 * OWN Redux cache last saw on air, and that cache goes stale the moment a
 * DIFFERENT page's action changes who's live — exactly what beat 4 does
 * (B leaves on B's page, then A goes live on A's page, which never
 * re-fetched). Skipping the reload here doesn't skip the prompt; it just
 * means this DJ's own click opens a dialog naming a DJ who already left,
 * and no `/flowsheet/join` is ever sent — which is indistinguishable from a
 * hang until you go looking for why the mutation wait timed out.
 */
async function goLiveNoCollision(flowsheet: FlowsheetPage): Promise<void> {
  const page = flowsheet.page;
  await flowsheet.goto();
  await flowsheet.waitForEntriesLoaded();
  await expect(flowsheet.goLiveButton).toBeEnabled({ timeout: 10000 });
  await page.waitForTimeout(300); // let a prior mutation's rollback settle

  const alreadyLive = (await flowsheet.liveStatus.textContent())?.includes("On Air");
  if (alreadyLive) return;

  const mutationResponse = page.waitForResponse(
    (r) => r.url().includes("/flowsheet/join") && r.request().method() === "POST",
    { timeout: 15000 }
  );
  await flowsheet.goLiveButton.click();
  const response = await mutationResponse;
  expect(response.ok(), "expected a plain go-live with no open-show collision").toBe(true);
  await expect(flowsheet.liveStatus).toContainText("On Air", { timeout: 10000 });
}

/**
 * Click one handoff-dialog button and report both halves of the resulting
 * `POST /flowsheet/join`: the decision this DJ actually sent, and what the
 * server answered. Beats 3 and 4 read `body.id`'s presence to tell a real
 * takeover from a co-host join — see go-live-handoff.ts's
 * `takeoverWasHonored`.
 */
async function decideHandoff(
  flowsheet: FlowsheetPage,
  choice: "go-live-handoff-join" | "go-live-handoff-takeover"
): Promise<{
  ok: boolean;
  intent: string;
  expectedShowId?: number;
  body: Record<string, unknown>;
}> {
  const page = flowsheet.page;
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/flowsheet/join") && r.request().method() === "POST",
      { timeout: 15000 }
    ),
    page.getByTestId(choice).click(),
  ]);
  const requestBody = (response.request().postDataJSON() ?? {}) as {
    intent?: string;
    expected_show_id?: number;
  };
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: response.ok(),
    intent: requestBody.intent ?? "",
    expectedShowId: requestBody.expected_show_id,
    body,
  };
}

/**
 * Reload `flowsheet`'s page and read back the two sources the banner has to
 * agree with each other: `GET /flowsheet/djs-on-air` (the full on-air
 * membership) and the `on_air` field on the paginated entries response
 * (backs the NowPlaying widget's single-name banner). Both fire on mount, so
 * one reload answers both.
 *
 * Reads both bodies through `page.route()` interception rather than
 * `page.waitForResponse(...).json()`. The latter reads the body via CDP's
 * `Network.getResponseBody` against the frame that served it — and a reload
 * is exactly a frame replacement, so the read can lose the race and throw
 * `Protocol error (Network.getResponseBody): No resource with given
 * identifier found` ("response body is not available for a response that
 * was navigated away from"), which is what happened locally on this file's
 * very first beat. `route.fetch()` performs the request itself and hands
 * back a body Playwright already holds in Node, decoupled from the
 * browser-side frame's lifecycle — fulfilling with that same response still
 * delivers the real data to the app, so this changes nothing about what the
 * page receives.
 */
async function fetchLiveState(flowsheet: FlowsheetPage): Promise<LiveState> {
  const page = flowsheet.page;
  let djsOnAir: RawOnAirDj[] | undefined;
  let onAir: { dj_name: string } | null | undefined;

  const isDjsOnAir = (url: URL) => url.pathname.endsWith("/flowsheet/djs-on-air");
  const isEntriesPage = (url: URL) =>
    url.pathname.includes("/flowsheet") && url.searchParams.has("page");

  await page.route(isDjsOnAir, async (route) => {
    const response = await route.fetch();
    djsOnAir = (await response.json()) as RawOnAirDj[];
    await route.fulfill({ response });
  });
  await page.route(isEntriesPage, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { on_air?: { dj_name: string } | null };
    onAir = body.on_air ?? null;
    await route.fulfill({ response });
  });

  try {
    await flowsheet.goto();
    await flowsheet.waitForEntriesLoaded();
    await expect
      .poll(() => djsOnAir !== undefined && onAir !== undefined, { timeout: 15000 })
      .toBe(true);
  } finally {
    await page.unroute(isDjsOnAir);
    await page.unroute(isEntriesPage);
  }

  return { djsOnAir: djsOnAir ?? [], onAir: onAir ?? null };
}
