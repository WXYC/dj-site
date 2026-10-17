import type { APIResponse, Locator, Page } from "@playwright/test";
import path from "path";
import { test, expect } from "../../fixtures/auth.fixture";
import { authServiceBaseUrl } from "../../helpers/device-auth";
import { requireEnv } from "../../helpers/env";
import { REVIEW_COPY } from "../../../src/components/experiences/modern/reviews/copy";
import { FIELD_NAMES } from "../../../lib/features/reviews/draftKeys";

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
  return {
    scrollRegion: page.locator("[data-scroll-region]"),
    fields: FIELD_NAMES.map((name) => page.getByRole("textbox", { name: COPY.fields[name].label, exact: true })),
    review: page.getByRole("textbox", { name: COPY.fields.review.label, exact: true }),
    consent: page.getByRole("group", { name: COPY.consent.legend }),
    slipHeading,
    column,
    grid: column.locator("xpath=.."),
    slip: page.getByRole("group", { name: COPY.slip.name }),
    saveDraft: page.getByRole("button", { name: COPY.saveDraft, exact: true }),
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

/** Every row of the slip puts its value at the same x: the label column holds its word, "Recommended" included. */
async function labelColumnProblems(page: Page): Promise<string[]> {
  await fontsReady(page);
  const starts = await editor(page).slip.evaluate((slip) =>
    Array.from(slip.children)
      .filter((row) => row.tagName === "DIV" && row.children.length === 2)
      .map((row) => ({ label: row.children[0].textContent ?? "", x: row.children[1].getBoundingClientRect().left })),
  );
  if (starts.length === 0) {
    return ["the slip has no rows"];
  }
  const first = starts[0].x;
  return starts
    .filter(({ x }) => Math.abs(x - first) > ROUNDING_PX)
    .map(({ label, x }) => `the value of "${label}" starts at ${x}px, not ${first}px`);
}

/** The slip sits right of the form: the editor is in two columns. */
async function sideBySideProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  const slip = await box(e.slipHeading);
  const fields = await Promise.all(e.fields.map(box));
  const formRight = Math.max(...fields.map((f) => f.right));
  return slip.left < formRight
    ? [`"${COPY.slip.heading}" starts at ${slip.left}px, left of the form's right edge ${formRight}px`]
    : [];
}

/** At two columns: the slip sits right of the form, stays in view to the end of the scroll, and the page does not scroll sideways. */
async function twoColumnProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  const problems = await sideBySideProblems(page);

  await scrollToEnd(e.scrollRegion);
  const region = await box(e.scrollRegion);
  const column = await box(e.column);
  const bar = await box(e.saveDraft.locator("xpath=.."));
  if (Math.abs(column.top - region.top) > 1) {
    problems.push(`the slip column's top is ${column.top}px, ${column.top - region.top}px from the scroll region's ${region.top}px`);
  }
  if (column.bottom > bar.top + 1) {
    problems.push(`the slip column ends at ${column.bottom}px, below the action bar's top ${bar.top}px`);
  }
  return [...problems, ...(await sidewaysProblems(page))];
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

/** At one column: the slip starts below the publishing question, and the action bar's buttons stay in view and clear of the fixed Appbar. */
async function oneColumnProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  const problems: string[] = [];
  const slip = await box(e.slipHeading);
  const consent = await box(e.consent);
  if (slip.top < consent.bottom) {
    problems.push(`"${COPY.slip.heading}" starts at ${slip.top}px, above the publishing question's end ${consent.bottom}px`);
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
 */
async function deleteDraft(page: Page, reviewId: number): Promise<void> {
  const response = await (await backend(page)).delete(`/reviews/${reviewId}`);
  expect([200, 204, 404], `DELETE /reviews/${reviewId} answered ${response.status()}`).toContain(response.status());
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

  test.afterEach(async ({ page }) => {
    if (reviewId !== null) {
      await deleteDraft(page, reviewId);
      reviewId = null;
    }
  });

  test("puts the slip right of the form, keeps it in view to the end, and does not scroll sideways", async ({ page }) => {
    // The sticky column ends 16px above the scroll region's top (#2256); the fix ticket removes this mark.
    test.fail(true, "WXYC/dj-site#2256");
    expect(await twoColumnProblems(page)).toEqual([]);
  });

  test("control: one column at 1440px fails the two-column check", async ({ page }) => {
    await applyControl(page, editor(page).grid, "grid", "grid-template-columns: minmax(0, 1fr)");
    expect(await twoColumnProblems(page)).not.toEqual([]);
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
    // "Recommended" overflows the slip's label column (#2257); the fix ticket removes this mark.
    test.fail(true, "WXYC/dj-site#2257");
    expect(await labelColumnProblems(page)).toEqual([]);
  });

  test("control: labels at their value's size push a value out of the column", async ({ page }) => {
    await tag(editor(page).slip, "slip");
    await page.addStyleTag({ content: "[data-e2e-slip] > div > strong { font-size: 1em !important; }" });
    expect(await labelColumnProblems(page)).not.toEqual([]);
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

  test.afterEach(async ({ page }) => {
    if (reviewId !== null) {
      await deleteDraft(page, reviewId);
      reviewId = null;
    }
  });

  test("stacks the slip under the publishing question and keeps the action bar clear of the Appbar", async ({ page }) => {
    expect(await oneColumnProblems(page)).toEqual([]);
  });

  test("control: two columns at 390px fail the one-column check", async ({ page }) => {
    await applyControl(page, editor(page).grid, "grid", "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(await oneColumnProblems(page)).not.toEqual([]);
  });

  test("control: an action bar with 8px of bottom padding runs under the Appbar", async ({ page }) => {
    await applyControl(page, editor(page).saveDraft.locator("xpath=.."), "bar", "padding-bottom: 8px");
    expect(await oneColumnProblems(page)).not.toEqual([]);
  });

  test("starts every slip value at the same x", async ({ page }) => {
    // "Recommended" overflows the slip's label column (#2257); the fix ticket removes this mark.
    test.fail(true, "WXYC/dj-site#2257");
    expect(await labelColumnProblems(page)).toEqual([]);
  });

  test("control: labels at their value's size push a value out of the column", async ({ page }) => {
    await tag(editor(page).slip, "slip");
    await page.addStyleTag({ content: "[data-e2e-slip] > div > strong { font-size: 1em !important; }" });
    expect(await labelColumnProblems(page)).not.toEqual([]);
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
    const album = `DOGA ${runTag}`;
    const mdContext = await browser.newContext({ baseURL, viewport, storageState: path.join(authDir, "musicDirector.json") });
    const djContext = await browser.newContext({ baseURL, viewport, storageState: path.join(authDir, "dj2.json") });
    const md = await mdContext.newPage();
    const dj = await djContext.newPage();
    let itemUrl: string | null = null;

    const row = (page: Page, region: string) =>
      page.getByRole("region", { name: region }).getByRole("listitem").filter({ hasText: album });

    try {
      await md.goto("/dashboard/reviews");
      const form = md.getByRole("form", { name: COPY.intake.logTitle });
      await form.getByLabel(new RegExp(`^${COPY.intake.artist}`)).fill(`Juana Molina ${runTag}`);
      await form.getByLabel(new RegExp(`^${COPY.intake.album}`)).fill(album);
      await form.getByRole("combobox", { name: new RegExp(`^${COPY.intake.format}`) }).click();
      await md.getByRole("option").filter({ hasNotText: COPY.intake.digital }).first().click();
      await form.getByRole("button", { name: COPY.intake.log }).click();
      await expect(row(md, COPY.screen.shelfTitle)).toBeVisible({ timeout: 15000 });

      await dj.goto("/dashboard/reviews");
      await row(dj, COPY.screen.shelfTitle).getByRole("button", { name: COPY.screen.checkOut, exact: true }).click();
      await row(dj, COPY.screen.checkoutsTitle).getByRole("button", { name: COPY.writeReview }).click();
      await dj.waitForURL(/\/dashboard\/reviews\/\d+$/, { timeout: 15000 });
      await editor(dj).review.fill(`A quiet record ${runTag}.`);
      await editor(dj).submit.click();
      await dj.getByRole("alertdialog").getByRole("button", { name: COPY.submit, exact: true }).click();
      await expect(dj.getByText(COPY.submittedBanner)).toBeVisible({ timeout: 15000 });

      await md.goto("/dashboard/reviews/music-directors");
      await md
        .getByRole("region", { name: new RegExp(`^${COPY.intake.waiting}`) })
        .getByRole("listitem")
        .filter({ hasText: album })
        .getByRole("link", { name: new RegExp(album) })
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
