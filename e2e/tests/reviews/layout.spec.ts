import type { Locator, Page } from "@playwright/test";
import path from "path";
import { test, expect } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
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
  await page.addStyleTag({ content: `[data-e2e-${name}] { ${important}; }` });
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

/** At two columns: the slip sits right of the form, stays in view to the end of the scroll, and the page does not scroll sideways. */
async function twoColumnProblems(page: Page): Promise<string[]> {
  const e = editor(page);
  const problems: string[] = [];
  const slip = await box(e.slipHeading);
  const fields = await Promise.all(e.fields.map(box));
  const formRight = Math.max(...fields.map((f) => f.right));
  if (slip.left < formRight) {
    problems.push(`"${COPY.slip.heading}" starts at ${slip.left}px, left of the form's right edge ${formRight}px`);
  }

  await scrollToEnd(e.scrollRegion);
  const region = await box(e.scrollRegion);
  const column = await box(e.column);
  const bar = await box(e.saveDraft.locator("xpath=.."));
  if (Math.abs(column.top - region.top) > 1) {
    problems.push(`the slip column's top is ${column.top}px, not the scroll region's ${region.top}px`);
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

/** A catalog release the service accepts a draft for: any release that exists. Read from the catalog's own search. */
async function findReleaseId(page: Page): Promise<number> {
  const rows = page.waitForResponse(
    async (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname.endsWith("/library/query") &&
      response.ok() &&
      ((await response.json().catch(() => null))?.results?.length ?? 0) > 0,
    { timeout: 30000 },
  );
  const dashboard = new DashboardPage(page);
  await dashboard.gotoCatalog();
  await dashboard.waitForPageLoad();
  await page.getByTestId("catalog-search-input").fill("a");
  return (await (await rows).json()).results[0].id;
}

/** Creates the DJ's own draft and opens it; `NewReview` replaces the address with the draft's. */
async function openNewDraft(page: Page): Promise<void> {
  const albumId = await findReleaseId(page);
  await page.goto(`/dashboard/reviews/new?album_id=${albumId}`);
  await page.waitForURL(/\/dashboard\/reviews\/\d+$/, { timeout: 20000 });
  await expect(editor(page).slipHeading).toBeVisible({ timeout: 15000 });
}

/** The author's Delete, so a run leaves no draft behind. */
async function deleteDraft(page: Page): Promise<void> {
  await page.getByRole("button", { name: COPY.delete, exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: COPY.delete, exact: true }).click();
  await page.waitForURL(/\/dashboard\/reviews$/, { timeout: 15000 });
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

  test.beforeEach(async ({ page }) => {
    await openNewDraft(page);
    await fillTall(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteDraft(page);
  });

  test("puts the slip right of the form, keeps it in view to the end, and does not scroll sideways", async ({ page }) => {
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
    expect(await sidewaysProblems(page)).toEqual([]);
    expect((await box(editor(page).slip)).width).toBeLessThan(SLIP_WIDTH_PX);
  });

  test("control: a bare min-content track scrolls sideways at a larger root font size", async ({ page }) => {
    await page.addStyleTag({ content: "html { font-size: 20px; }" });
    await applyControl(page, editor(page).grid, "grid", "grid-template-columns: minmax(20rem, 1fr) min-content");
    expect(await sidewaysProblems(page)).not.toEqual([]);
  });

  test("starts every slip value at the same x", async ({ page }) => {
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

  test.beforeEach(async ({ page }) => {
    await openNewDraft(page);
    await fillTall(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteDraft(page);
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
 */
test.describe("Record page filing arms", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("show one arm's controls at a time, and Tab never reaches the closed arm", async ({ browser }) => {
    test.setTimeout(180_000);

    const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    const runTag = Date.now().toString(36);
    const album = `DOGA ${runTag}`;
    const mdContext = await browser.newContext({ baseURL, storageState: path.join(authDir, "musicDirector.json") });
    const djContext = await browser.newContext({ baseURL, storageState: path.join(authDir, "dj2.json") });
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

      const newArm = md.getByRole("button", { name: "File to library" });
      const existingArm = md.getByRole("searchbox", { name: COPY.intakeItem.searchLibrary });
      const chooseNew = md.getByRole("radio", { name: COPY.intakeItem.fileNew });
      const chooseExisting = md.getByRole("radio", { name: COPY.intakeItem.fileExisting });

      // Before a choice neither arm is on the page.
      await expect(newArm).toBeHidden();
      await expect(existingArm).toBeHidden();

      // Open both arms, so the one that closes is mounted and only `display: none` can hide it.
      await chooseExisting.check();
      await chooseNew.check();
      await expect(newArm).toBeVisible();
      await expect(existingArm).toBeHidden();
      expect(await tabReachesClosedArm(md, chooseNew)).toBe(false);

      await chooseExisting.check();
      await expect(existingArm).toBeVisible();
      await expect(newArm).toBeHidden();
      expect(await tabReachesClosedArm(md, chooseExisting)).toBe(false);
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

/** Tabs forward and back from `start` past every control on the page, reporting whether focus ever lands inside a `hidden` box. */
async function tabReachesClosedArm(page: Page, start: Locator): Promise<boolean> {
  const inClosedArm = () => page.evaluate(() => document.activeElement?.closest("[hidden]") != null);
  for (const key of ["Tab", "Shift+Tab"]) {
    await start.focus();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press(key);
      if (await inClosedArm()) {
        return true;
      }
    }
  }
  return false;
}
