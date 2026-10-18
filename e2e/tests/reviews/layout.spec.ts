import type { APIResponse, Locator, Page, TestInfo } from "@playwright/test";
import path from "path";
import { test, expect } from "../../fixtures/auth.fixture";
import { authServiceBaseUrl } from "../../helpers/device-auth";
import { requireEnv } from "../../helpers/env";
import { REVIEW_COPY } from "../../../src/components/experiences/modern/reviews/copy";

const authDir = path.join(__dirname, "../../.auth");

const COPY = REVIEW_COPY;

/**
 * What the review screens' layout promises, measured in a real browser: jsdom applies no container query, media
 * query or sticky position and measures no font, so none of these facts can be checked in the unit suite.
 *
 * Every check is a function that reports its breaks as a list of lines, and every check has a negative control: a
 * rule injected with `addStyleTag` that undoes the fix, after which the same function must report the break. A
 * check that passes against its own control proves nothing. Elements are found by role and accessible name and
 * measured by their boxes; no pixel constant from the source (the Appbar's height, the editor's breakpoint) is
 * repeated here, and nothing counts fields, rows or heading levels.
 *
 * The 4.25in slip is 408 CSS px at any root font size (an inch is 96px).
 */
const SLIP_WIDTH_PX = 408;
/** Sub-pixel layout rounding, not a tolerance for overhang. */
const ROUNDING_PX = 0.5;
const SHADOW_BOTTOM_PX = 5;
const SHADOW_SIDE_PX = 4;
/** Each editor test opens a draft, fills it and deletes it around its check; the config's 20s is not room for that on a loaded runner. */
const EDITOR_TEST_TIMEOUT_MS = 60_000;
/** Tab presses allowed in one direction before a walk of the File it section counts as stuck. */
const TAB_LIMIT = 120;

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

const box = (target: Locator): Promise<Box> =>
  target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  });

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** The editor's pieces, found by what they are called. */
function editor(page: Page) {
  const slipHeading = page.getByRole("region", { name: COPY.slip.heading });
  const column = slipHeading.locator("xpath=..");
  const grid = column.locator("xpath=..");
  const saveDraft = page.getByRole("button", { name: COPY.saveDraft, exact: true });
  return {
    scrollRegion: page.locator("[data-scroll-region]"),
    /** The grid's other column: the slip fields this draft offers (a typed draft has no FCC field) and the rest of the form. */
    formFields: grid.locator("xpath=./*[1]").getByRole("textbox"),
    review: page.getByRole("textbox", { name: COPY.fields.review.label, exact: true }),
    consent: page.getByRole("group", { name: COPY.consent.legend }),
    slipHeading,
    column,
    grid,
    slip: page.getByRole("group", { name: COPY.slip.name }),
    saveDraft,
    /** The sticky row that holds Delete, the saved state, Save draft and Submit. */
    actionBar: saveDraft.locator("xpath=.."),
    submit: page.getByRole("button", { name: COPY.submit, exact: true }),
    appbar: page.locator(".ignoreClassic").first(),
  };
}

/** Marks a box so a control's rule can name it: the editor sets its layout from emotion classes, which a rule here cannot name. */
async function tag(target: Locator, name: string) {
  await target.evaluate((el, attribute) => el.setAttribute(attribute, ""), `data-e2e-${name}`);
}

/** Injects `declarations` for the tagged box. `!important` outranks the editor's own rules, which sit in a container query. */
async function undo(page: Page, name: string, declarations: string) {
  const important = declarations.replace(/;?\s*$/, "").split(";").map((d) => `${d.trim()} !important`).join("; ");
  return page.addStyleTag({ content: `[data-e2e-${name}] { ${important}; }` });
}

/** Waits for the faces the page is loading, so a measure reads the face the site serves and not the fallback drawn before it (next/font swaps). */
async function fontsReady(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function scrollToEnd(target: Locator) {
  await target.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        el.scrollTop = el.scrollHeight;
        // Sticky offsets and the sticky column's measured bound settle on the frame after the scroll.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/** Whether the page, or the scroll region the dashboard keeps its pages in, scrolls sideways. */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const region = document.querySelector("[data-scroll-region]");
    return (
      document.documentElement.scrollWidth > window.innerWidth ||
      (region !== null && region.scrollWidth > region.clientWidth + 1)
    );
  });
}

async function sidewaysProblems(page: Page): Promise<string[]> {
  return (await scrollsSideways(page)) ? ["the page scrolls sideways"] : [];
}

const NO_ROWS = "the slip has no rows";
const SLIP_LEFT_OF_FORM = "left of the form's right edge";
const SLIP_ABOVE_CONSENT = "above the publishing question's end";
const STICKY_TOP = "from the scroll region's top";
const STICKY_BOTTOM = "below the action bar's top";

/** A slip row whose value does not start at the first row's x, and by how much. */
type Misaligned = { label: string; by: number; line: string };

/** The slip rows whose value does not start where the first row's does, or null when the slip has no rows. */
async function misalignedValues(page: Page): Promise<Misaligned[] | null> {
  await fontsReady(page);
  const starts = await editor(page).slip.evaluate((slip) =>
    Array.from(slip.children)
      .filter((row) => row.tagName === "DIV" && row.children.length === 2)
      .map((row) => ({ label: row.children[0].textContent ?? "", x: row.children[1].getBoundingClientRect().left })),
  );
  if (starts.length === 0) {
    return null;
  }
  const first = starts[0].x;
  return starts
    .filter(({ x }) => Math.abs(x - first) > ROUNDING_PX)
    .map(({ label, x }) => ({ label, by: x - first, line: `the value of "${label}" starts at ${x}px, not ${first}px` }));
}

/** Every row of the slip puts its value at the same x: the label column holds its word, "Recommended" included. */
async function labelColumnProblems(page: Page): Promise<string[]> {
  const rows = await misalignedValues(page);
  return rows === null ? [NO_ROWS] : rows.map(({ line }) => line);
}

/** The slip sits right of the form: the editor is in two columns. */
async function sideBySideProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  const slip = await box(e.slipHeading);
  const fields = await Promise.all((await e.formFields.all()).map(box));
  if (fields.length === 0) {
    return ["the form column has no fields"];
  }
  const formRight = Math.max(...fields.map((f) => f.right));
  return slip.left < formRight
    ? [`"${COPY.slip.heading}" starts at ${slip.left}px, ${SLIP_LEFT_OF_FORM} ${formRight}px`]
    : [];
}

/**
 * Scrolls the region to the middle of the stretch where the grid fills the view from the scroll region's top down to
 * the stuck action bar. There neither end of the grid is in view, so nothing clamps the sticky slip column: its top is
 * held by its sticky offset alone and its bottom by its own bound alone. Returns the stretch's length; at 0 or less the
 * grid never fills the view.
 */
async function scrollToGridMiddle(page: Page): Promise<number> {
  const e = editor(page);
  const grid = await box(e.grid);
  const bar = await box(e.actionBar);
  return e.scrollRegion.evaluate(
    (el, { gridTop, gridHeight, barHeight }) =>
      new Promise<number>((resolve) => {
        const stretch = gridHeight - (el.clientHeight - barHeight);
        el.scrollTop += gridTop - el.getBoundingClientRect().top + stretch / 2;
        // Sticky offsets settle on the frame after the scroll.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(stretch)));
      }),
    { gridTop: grid.top, gridHeight: grid.height, barHeight: bar.height },
  );
}

/** Scrolled to where the form runs past the slip column at both ends, the column's top is at the scroll region's top and its bottom at or above the stuck action bar's top, each within 1px. */
async function stickyColumnProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  const stretch = await scrollToGridMiddle(page);
  if (stretch < 2) {
    return [`the grid runs ${stretch}px past the view above the action bar, so the slip column never sticks`];
  }
  const region = await box(e.scrollRegion);
  const column = await box(e.column);
  const bar = await box(e.actionBar);
  const problems: string[] = [];
  if (Math.abs(column.top - region.top) > 1) {
    problems.push(`the slip column's top is ${column.top - region.top}px ${STICKY_TOP} at ${region.top}px`);
  }
  if (column.bottom > bar.top + 1) {
    problems.push(`the slip column ends at ${column.bottom}px, ${STICKY_BOTTOM} at ${bar.top}px`);
  }
  return problems;
}

/** At two columns: the slip sits right of the form, stays in view while the form scrolls past, and the page does not scroll sideways. */
async function twoColumnProblems(page: Page): Promise<string[]> {
  return [...(await sideBySideProblems(page)), ...(await stickyColumnProblems(page)), ...(await sidewaysProblems(page))];
}

/** The slip column's top at the end of the scroll, less the scroll region's top. */
async function columnTopAtEnd(page: Page): Promise<number> {
  const e = editor(page);
  await scrollToEnd(e.scrollRegion);
  return (await box(e.column)).top - (await box(e.scrollRegion)).top;
}

/**
 * A known defect: "Recommended" is wider than the slip's label column, so its value, and no other row's, starts about
 * 5.3px right of the first row's.
 */
const KNOWN_LABEL_OVERFLOW = { defect: `"${COPY.slip.recommended}" overflows the slip's label column`, label: COPY.slip.recommended, px: 5.3 };
const isKnownLabelOverflow = (rows: Misaligned[] | null) =>
  rows !== null && rows.length === 1 && rows[0].label === KNOWN_LABEL_OVERFLOW.label && Math.abs(rows[0].by - KNOWN_LABEL_OVERFLOW.px) <= 1;

/**
 * Marks the running test as expected to fail on a known layout defect, then asserts `problems` is empty. The caller
 * first pins the defect's own measurement, so a different break, or this one by another amount, fails before the mark;
 * the measured lines go on the test as an annotation. Nothing in the test runs after the mark. A timeout ends the test
 * as timed out, not failed, so it never matches the mark, and the draft's cleanup clears the mark before it throws
 * (`deleteDraft`).
 */
function expectKnownDefect(defect: string, problems: string[]) {
  test.info().annotations.push({ type: "known-defect", description: `${defect}: ${problems.join("; ")}` });
  test.fail(true, defect);
  expect(problems).toEqual([]);
}

/** Pins the label column's known defect, the one overflowing row by its measured amount, then marks the test on it. */
async function expectKnownLabelOverflow(page: Page) {
  const rows = await misalignedValues(page);
  expect(rows, NO_ROWS).not.toBeNull();
  expect(isKnownLabelOverflow(rows), `the slip's misaligned values are not the known overflow: ${JSON.stringify(rows)}`).toBe(true);
  expectKnownDefect(KNOWN_LABEL_OVERFLOW.defect, (rows ?? []).map(({ line }) => line));
}

/**
 * The label-column control: the slip's labels back at their value's size. Returns what the check reports before and
 * after the rule goes in, because a known defect can already report a line before it; the control must change the
 * report, not merely find it non-empty.
 */
async function labelColumnUnderControl(page: Page): Promise<{ before: string[]; after: string[] }> {
  const before = await labelColumnProblems(page);
  await tag(editor(page).slip, "slip");
  await page.addStyleTag({ content: "[data-e2e-slip] > div > strong { font-size: 1em !important; }" });
  return { before, after: await labelColumnProblems(page) };
}

/** The slip keeps its 4.25in whatever the gutter and padding around it take. */
async function slipWidthProblems(page: Page): Promise<string[]> {
  const { width } = await box(editor(page).slip);
  return Math.abs(width - SLIP_WIDTH_PX) > ROUNDING_PX ? [`the slip is ${width}px wide, not ${SLIP_WIDTH_PX}px`] : [];
}

/** The slip's shadow has room inside its sticky column, scrolled to the column's end. */
async function shadowRoomProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  await scrollToEnd(e.scrollRegion);
  await scrollToEnd(e.column);
  const slip = await box(e.slip);
  const column = await box(e.column);
  const problems: string[] = [];
  if (column.bottom - slip.bottom < SHADOW_BOTTOM_PX) {
    problems.push(`the slip ends ${column.bottom - slip.bottom}px above its column's bottom edge`);
  }
  if (slip.left - column.left < SHADOW_SIDE_PX) {
    problems.push(`the slip starts ${slip.left - column.left}px inside its column's left edge`);
  }
  if (column.right - slip.right < SHADOW_SIDE_PX) {
    problems.push(`the slip ends ${column.right - slip.right}px inside its column's right edge`);
  }
  return problems;
}

const BAR_UNDER_APPBAR = "below the Appbar's top";

/**
 * The lowest bottom edge among the action bar's drawn pieces: its last row. The bar wraps where its text puts it (at
 * 390px Submit starts a second row at the left, under Save draft), so a button that misses the right-aligned Appbar
 * may miss it only because of where the wrap fell; the bar's bottom padding keeps every row above the Appbar's top.
 */
async function lastRowBottom(bar: Locator): Promise<number> {
  return bar.evaluate((el) =>
    Math.max(
      ...Array.from(el.children)
        .map((child) => child.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => r.bottom),
    ),
  );
}

/** At one column: the slip starts below the publishing question, the action bar's buttons stay in view and clear of the fixed Appbar, and every row of the bar ends above the Appbar's top. */
async function oneColumnProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  const problems: string[] = [];
  const slip = await box(e.slipHeading);
  const consent = await box(e.consent);
  if (slip.top < consent.bottom) {
    problems.push(`"${COPY.slip.heading}" starts at ${slip.top}px, ${SLIP_ABOVE_CONSENT} ${consent.bottom}px`);
  }

  await scrollToEnd(e.scrollRegion);
  const appbar = await box(e.appbar);
  const viewport = page.viewportSize()!;
  for (const [name, button] of [[COPY.submit, e.submit], [COPY.saveDraft, e.saveDraft]] as const) {
    const b = await box(button);
    if (b.left < 0 || b.top < 0 || b.right > viewport.width || b.bottom > viewport.height) {
      problems.push(`${name} is outside the viewport`);
    }
    if (overlaps(b, appbar)) {
      problems.push(`${name} runs under the Appbar`);
    }
  }
  const lastRow = await lastRowBottom(e.actionBar);
  if (lastRow > appbar.top + ROUNDING_PX) {
    problems.push(`the action bar's last row ends at ${lastRow}px, ${BAR_UNDER_APPBAR} ${appbar.top}px`);
  }
  return [...problems, ...(await sidewaysProblems(page))];
}

/**
 * The Backend, called as the page's signed-in user: the context's session cookie buys a JWT from the auth service, the
 * way the DJ site's own client does (`getJWTToken`), and the JWT goes out as the bearer.
 */
async function backend(page: Page) {
  const tokenResponse = await page.request.get(`${authServiceBaseUrl()}/auth/token`);
  expect(tokenResponse.ok(), `GET /auth/token answered ${tokenResponse.status()}`).toBe(true);
  const { token } = (await tokenResponse.json()) as { token: string };
  const { NEXT_PUBLIC_BACKEND_URL: base } = requireEnv("reviews/layout.spec.ts", ["NEXT_PUBLIC_BACKEND_URL"]);
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: (route: string): Promise<APIResponse> => page.request.get(`${base}${route}`, { headers }),
    delete: (route: string): Promise<APIResponse> => page.request.delete(`${base}${route}`, { headers }),
  };
}

/** A library release the service accepts a draft for: any release that exists, read from the catalog's query endpoint, not its search screen. */
async function findReleaseId(page: Page): Promise<number> {
  const response = await (await backend(page)).get("/library/query?limit=1");
  expect(response.ok(), `GET /library/query answered ${response.status()}`).toBe(true);
  const { results } = (await response.json()) as { results: { id: number }[] };
  expect(results.length, "the E2E database has no library release").toBeGreaterThan(0);
  return results[0].id;
}

/** Creates the DJ's own draft and opens it; `NewReview` replaces the address with the draft's. Returns the draft's id. */
async function openNewDraft(page: Page): Promise<number> {
  const albumId = await findReleaseId(page);
  await page.goto(`/dashboard/reviews/new?album_id=${albumId}`);
  await page.waitForURL(/\/dashboard\/reviews\/\d+$/, { timeout: 20000 });
  await expect(editor(page).slipHeading).toBeVisible({ timeout: 15000 });
  await fontsReady(page);
  return Number(new URL(page.url()).pathname.split("/").pop());
}

/**
 * Deletes the draft through the API with the page's session, so a run leaves no draft behind. Not the author's Delete:
 * a control can leave the action bar under the Appbar, where that button can't be pressed.
 *
 * Runs after the test, so a failure here clears the test's expected-to-fail mark before it is thrown: a test marked
 * as failing on a known defect would otherwise count a failed delete as that defect and pass.
 */
async function deleteDraft(page: Page, reviewId: number, testInfo: TestInfo): Promise<void> {
  try {
    const response = await (await backend(page)).delete(`/reviews/${reviewId}`);
    expect([200, 204, 404], `DELETE /reviews/${reviewId} answered ${response.status()}`).toContain(response.status());
  } catch (error) {
    testInfo.expectedStatus = "passed";
    throw error;
  }
}

/** Text tall enough to scroll the page and the sticky column, in the field the slip prints in full. */
async function fillTall(page: Page): Promise<void> {
  await editor(page).review.fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1} of a long review`).join("\n"));
}

/** A control: tags `name` and returns once its rule is in. */
async function applyControl(page: Page, target: Locator, name: string, declarations: string) {
  await tag(target, name);
  await undo(page, name, declarations);
}

test.describe("Review editor layout, two columns", () => {
  test.use({ storageState: path.join(authDir, "dj2.json"), viewport: { width: 1440, height: 900 } });

  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS });

  let reviewId: number | null = null;

  test.beforeEach(async ({ page }) => {
    reviewId = await openNewDraft(page);
    await fillTall(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (reviewId !== null) {
      const id = reviewId;
      reviewId = null;
      await deleteDraft(page, id, testInfo);
    }
  });

  test("puts the slip right of the form, keeps it in view while the form scrolls past, and does not scroll sideways", async ({ page }) => {
    expect(await twoColumnProblems(page)).toEqual([]);
  });

  test("control: a slip column that does not stick leaves the scroll region's top", async ({ page }) => {
    await applyControl(page, editor(page).column, "column", "position: static");
    expect(await stickyColumnProblems(page)).toContainEqual(expect.stringContaining(STICKY_TOP));
    // Nor does a column that does not stick end the scroll at the scroll region's top.
    expect(Math.abs(await columnTopAtEnd(page))).toBeGreaterThan(1);
  });

  test("control: a slip column without its bound runs below the action bar's top", async ({ page }) => {
    await applyControl(page, editor(page).column, "column", "max-height: none");
    expect(await stickyColumnProblems(page)).toContainEqual(expect.stringContaining(STICKY_BOTTOM));
  });

  test("keeps the slip column at the scroll region's top at the end of the scroll", async ({ page }) => {
    const offset = await columnTopAtEnd(page);
    expect(Math.abs(offset), `the slip column's top at the end of the scroll is ${offset}px from the scroll region's`).toBeLessThanOrEqual(1);
  });

  test("control: one column at 1440px fails the two-column check", async ({ page }) => {
    await applyControl(page, editor(page).grid, "grid", "grid-template-columns: minmax(0, 1fr)");
    expect(await twoColumnProblems(page)).toContainEqual(expect.stringContaining(SLIP_LEFT_OF_FORM));
  });

  test("keeps the slip 4.25in wide", async ({ page }) => {
    expect(await slipWidthProblems(page)).toEqual([]);
  });

  test("control: a slip track without the gutter's width narrows the slip", async ({ page }) => {
    await applyControl(page, editor(page).grid, "grid", "grid-template-columns: minmax(20rem, 1fr) minmax(0, 4.25in)");
    expect(await slipWidthProblems(page)).not.toEqual([]);
  });

  test("leaves the slip's shadow room inside its column", async ({ page }) => {
    expect(await shadowRoomProblems(page)).toEqual([]);
  });

  test("control: a column without padding leaves the shadow no room", async ({ page }) => {
    await applyControl(page, editor(page).column, "column", "padding: 0");
    expect(await shadowRoomProblems(page)).not.toEqual([]);
  });

  test("narrows the slip at a larger root font size instead of scrolling sideways", async ({ page }) => {
    await page.addStyleTag({ content: "html { font-size: 20px; }" });
    // Still two columns: in one column the slip is min(4.25in, 100%) for a reason that has nothing to do with its track.
    expect(await sideBySideProblems(page)).toEqual([]);
    expect(await sidewaysProblems(page)).toEqual([]);
    expect((await box(editor(page).slip)).width).toBeLessThan(SLIP_WIDTH_PX);
  });

  test("control: a bare min-content track scrolls sideways at a larger root font size", async ({ page }) => {
    await page.addStyleTag({ content: "html { font-size: 20px; }" });
    await applyControl(page, editor(page).grid, "grid", "grid-template-columns: minmax(20rem, 1fr) min-content");
    expect(await sidewaysProblems(page)).not.toEqual([]);
  });

  test("starts every slip value at the same x", async ({ page }) => {
    await expectKnownLabelOverflow(page);
  });

  test("control: labels at their value's size push a value out of the column", async ({ page }) => {
    const { before, after } = await labelColumnUnderControl(page);
    expect(after).not.toEqual([]);
    expect(after).not.toEqual(before);
    expect(isKnownLabelOverflow(await misalignedValues(page))).toBe(false);
  });
});

test.describe("Review editor layout, one column", () => {
  test.use({ storageState: path.join(authDir, "dj2.json"), viewport: { width: 390, height: 844 } });

  test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS });

  let reviewId: number | null = null;

  test.beforeEach(async ({ page }) => {
    reviewId = await openNewDraft(page);
    await fillTall(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (reviewId !== null) {
      const id = reviewId;
      reviewId = null;
      await deleteDraft(page, id, testInfo);
    }
  });

  test("stacks the slip under the publishing question and keeps the action bar clear of the Appbar", async ({ page }) => {
    expect(await oneColumnProblems(page)).toEqual([]);
  });

  test("control: two columns at 390px fail the one-column check", async ({ page }) => {
    await applyControl(page, editor(page).grid, "grid", "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(await oneColumnProblems(page)).toContainEqual(expect.stringContaining(SLIP_ABOVE_CONSENT));
  });

  test("control: an action bar with 8px of bottom padding runs under the Appbar", async ({ page }) => {
    await applyControl(page, editor(page).actionBar, "bar", "padding-bottom: 8px");
    expect(await oneColumnProblems(page)).toContainEqual(expect.stringContaining(BAR_UNDER_APPBAR));
  });

  test("starts every slip value at the same x", async ({ page }) => {
    await expectKnownLabelOverflow(page);
  });

  test("control: labels at their value's size push a value out of the column", async ({ page }) => {
    const { before, after } = await labelColumnUnderControl(page);
    expect(after).not.toEqual([]);
    expect(after).not.toEqual(before);
    expect(isKnownLabelOverflow(await misalignedValues(page))).toBe(false);
  });
});

/**
 * The record page's two filing arms. A closed arm carries `hidden` and `display: none`: in a browser only
 * `display: none` hides it, because the arm's Stack sets `display: flex`, which beats the browser's `[hidden]`
 * rule, while jsdom hides on the attribute alone. So this is the only place the rule that does the work is pinned.
 *
 * Each arm is found by a control it holds (the bench's Genre, the library search) while it is open, and tagged, so the
 * check measures the arm's own box after it closes rather than a locator that may match nothing.
 */
test.describe("Record page filing arms", () => {
  test("show one arm's controls at a time, and Tab never reaches the closed arm", async ({ browser }) => {
    test.setTimeout(180_000);

    const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    const viewport = { width: 1440, height: 900 };
    const runTag = Date.now().toString(36);
    const artist = `Juana Molina ${runTag}`;
    const album = `DOGA ${runTag}`;
    const mdContext = await browser.newContext({ baseURL, viewport, storageState: path.join(authDir, "musicDirector.json") });
    const djContext = await browser.newContext({ baseURL, viewport, storageState: path.join(authDir, "dj2.json") });
    const md = await mdContext.newPage();
    const dj = await djContext.newPage();
    let itemUrl: string | null = null;

    const shelfRow = (page: Page) =>
      page.getByRole("region", { name: COPY.screen.shelfTitle }).getByRole("listitem").filter({ hasText: album });

    try {
      await md.goto("/dashboard/reviews/music-directors");
      // The form lives in the Add a record dialog, which the tab's button opens.
      await md.getByRole("button", { name: COPY.intake.log }).click();
      const form = md.getByRole("dialog", { name: COPY.intake.logTitle }).getByRole("form", { name: COPY.intake.logTitle });
      await form.getByLabel(new RegExp(`^${COPY.intake.artist}`)).fill(artist);
      await form.getByLabel(new RegExp(`^${COPY.intake.album}`)).fill(album);
      // Format shows once the record arrived as a disc or a record.
      await form.getByRole("radio", { name: COPY.intake.arrivedAsDisc }).click();
      await form.getByRole("combobox", { name: new RegExp(`^${COPY.intake.format}`) }).click();
      await md.getByRole("option").first().click();
      // Leaving the page before the POST is sent would drop the write.
      const logged = md.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/intake"));
      await form.getByRole("button", { name: COPY.intake.log }).click();
      expect((await logged).ok()).toBe(true);
      await md.goto("/dashboard/reviews");
      await expect(shelfRow(md)).toBeVisible({ timeout: 15000 });

      await dj.goto("/dashboard/reviews");
      const checkedOut = dj.waitForResponse((r) => r.request().method() === "POST" && /\/intake\/\d+\/checkout$/.test(new URL(r.url()).pathname));
      await shelfRow(dj).getByRole("button", { name: COPY.screen.checkOut, exact: true }).click();
      expect((await checkedOut).ok()).toBe(true);
      await dj.goto("/dashboard/reviews/mine");
      await dj
        .getByRole("tabpanel", { name: COPY.myReviews.stages.open })
        .getByRole("listitem")
        .filter({ hasText: album })
        .getByRole("button", { name: COPY.writeReview })
        .click();
      // The editor's address carries where it was opened from, for its back link.
      await dj.waitForURL(/\/dashboard\/reviews\/\d+(\?.*)?$/, { timeout: 15000 });
      await editor(dj).review.fill(`A quiet record ${runTag}.`);
      await editor(dj).submit.click();
      await dj.getByRole("alertdialog").getByRole("button", { name: COPY.submit, exact: true }).click();
      await expect(dj.getByText(COPY.submittedBanner)).toBeVisible({ timeout: 15000 });

      await md.goto("/dashboard/reviews/music-directors");
      // The New music tab shows one stage at a time, under chips that draw once the intake read lands. Chromium names a chip "Label , count".
      const waitingChip = md.getByRole("tab", { name: new RegExp(`^${COPY.intake.waiting}\\s*,`) });
      await expect(waitingChip).toBeVisible({ timeout: 15000 });
      await waitingChip.click();
      await md
        .getByRole("tabpanel", { name: COPY.intake.waiting, exact: true })
        .getByRole("listitem")
        .filter({ hasText: album })
        .getByRole("link", { name: artist, exact: true })
        .click();
      await md.waitForURL(/\/dashboard\/admin\/intake\/\d+$/, { timeout: 15000 });
      itemUrl = md.url();
      await md.getByRole("button", { name: COPY.intakeItem.useThisReview, exact: true }).click();
      await expect(md.getByRole("radio", { name: COPY.intakeItem.fileNew })).toBeVisible({ timeout: 15000 });

      const fileIt = md.getByRole("region", { name: COPY.intakeItem.fileIt });
      const genre = fileIt.getByRole("combobox", { name: "Genre" });
      const search = fileIt.getByRole("searchbox", { name: COPY.intakeItem.searchLibrary });
      const chooseNew = md.getByRole("radio", { name: COPY.intakeItem.fileNew });
      const chooseExisting = md.getByRole("radio", { name: COPY.intakeItem.fileExisting });
      const newArm = md.locator("[data-e2e-arm-new]");
      const existingArm = md.locator("[data-e2e-arm-existing]");

      // Before a choice neither arm is mounted.
      await expect(genre).toHaveCount(0);
      await expect(search).toHaveCount(0);

      // Open both arms, so the one that closes stays mounted and only `display: none` can hide it.
      await tag(fileIt, "file-it");
      await chooseExisting.check();
      await expect(search).toBeVisible({ timeout: 15000 });
      await tagArm(search, "arm-existing");
      await chooseNew.check();
      await expect(genre).toBeVisible({ timeout: 15000 });
      await tagArm(genre, "arm-new");

      // "Already in the library?" closed: it comes after the open bench, so the walk must cross the whole bench to reach it.
      expect(await closedArmProblems(md, existingArm, "arm-existing", chooseNew)).toEqual([]);
      await chooseExisting.check();
      await expect(search).toBeVisible();
      expect(await closedArmProblems(md, newArm, "arm-new", chooseExisting)).toEqual([]);

      // Controls: a closed arm drawn anyway is seen, and Tab reaches it, in each position.
      const showNew = await undo(md, "arm-new", "display: flex");
      expect(await closedArmProblems(md, newArm, "arm-new", chooseExisting)).toEqual(CLOSED_ARM_BREAKS);
      await showNew.evaluate((style) => style.parentNode?.removeChild(style));
      await chooseNew.check();
      await expect(genre).toBeVisible();
      await undo(md, "arm-existing", "display: flex");
      expect(await closedArmProblems(md, existingArm, "arm-existing", chooseNew)).toEqual(CLOSED_ARM_BREAKS);
    } finally {
      if (itemUrl) {
        await md.goto(itemUrl).catch(() => {});
        await md.getByRole("button", { name: COPY.intakeItem.delete, exact: true }).click().catch(() => {});
        await md.getByRole("alertdialog").getByRole("button", { name: COPY.intakeItem.delete, exact: true }).click().catch(() => {});
      }
      await mdContext.close().catch(() => {});
      await djContext.close().catch(() => {});
    }
  });
});

/** Tags the filing arm that holds `control`: the File it section's child it sits in. */
async function tagArm(control: Locator, name: string) {
  await control.evaluate((el, attribute) => {
    let arm: Element = el;
    while (arm.parentElement && !arm.parentElement.hasAttribute("data-e2e-file-it")) {
      arm = arm.parentElement;
    }
    arm.setAttribute(attribute, "");
  }, `data-e2e-${name}`);
}

const CLOSED_ARM_BREAKS = ["the closed arm is drawn", "Tab reaches the closed arm"];

/** A closed arm is not drawn, and Tab, walked both ways from the open arm's radio through the File it section, never focuses inside it. */
async function closedArmProblems(page: Page, arm: Locator, name: string, start: Locator): Promise<string[]> {
  if ((await arm.count()) !== 1) {
    return ["the closed arm is not on the page"];
  }
  const problems: string[] = [];
  if (await arm.isVisible()) {
    problems.push(CLOSED_ARM_BREAKS[0]);
  }
  const walk = await tabWalk(page, start, `data-e2e-${name}`);
  if (walk === "stuck") {
    problems.push(`Tab did not leave the File it section in ${TAB_LIMIT} presses`);
  } else if (walk === "reached") {
    problems.push(CLOSED_ARM_BREAKS[1]);
  }
  return problems;
}

/** Tabs forward, then back, from `start` until focus leaves the File it section, reporting whether it ever lands inside the box carrying `attribute`. */
async function tabWalk(page: Page, start: Locator, attribute: string): Promise<"reached" | "clear" | "stuck"> {
  const where = () =>
    page.evaluate((armAttribute) => {
      const active = document.activeElement;
      return {
        inArm: active?.closest(`[${armAttribute}]`) != null,
        inSection: active?.closest("[data-e2e-file-it]") != null,
      };
    }, attribute);
  for (const key of ["Tab", "Shift+Tab"]) {
    await start.focus();
    let left = false;
    for (let i = 0; i < TAB_LIMIT && !left; i++) {
      await page.keyboard.press(key);
      const { inArm, inSection } = await where();
      if (inArm) {
        return "reached";
      }
      left = !inSection;
    }
    if (!left) {
      return "stuck";
    }
  }
  return "clear";
}
