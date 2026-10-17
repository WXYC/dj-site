import type { Page } from "@playwright/test";
import path from "path";
import { test, expect, INTAKE_DJ_USER, INTAKE_MD_USER } from "../../fixtures/auth.fixture";
import { setExperienceViaAccount } from "../../helpers/experience";
import { REVIEW_COPY } from "../../../src/components/experiences/modern/reviews/copy";

const authDir = path.join(__dirname, "../../.auth");

const COPY = REVIEW_COPY;
const NEW_ARTIST_ROW = (name: string) => `Create new artist "${name}"`;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A line that ends in a value the run decides (a date): matches the copy's words around any value. */
function aroundValue(line: (value: string) => string): RegExp {
  const marker = "\u0000";
  const [head, tail] = line(marker).split(marker);
  return new RegExp(`^${escapeRegExp(head)}.+${escapeRegExp(tail)}$`);
}

/**
 * The intake golden path, from logging a record to the librarian's finalize:
 * a music director logs a disc, a DJ checks it out and submits a review, the
 * music director chooses that review, prints the slip, files the record to the
 * library, the DJ edits the review after it was printed, and the music
 * director confirms the record in the classic librarian's list.
 *
 * It runs against a real Backend-Service, which is the point: the From line
 * only reads "who has this record" when the review's author id equals the
 * record's holder id, and every fake-backed spec builds both from one string.
 *
 * One test, not a serial describe: each beat depends on the previous one's
 * server state, and a retry must start over with a record of its own. The
 * record's names carry a per-run tag so a retry, or another run against the
 * same database, never reads a sibling's row. The spec signs in only as the
 * two identities auth.setup.ts provisions for it, because its last steps
 * switch the music director's interface setting.
 */
test("the intake golden path, from logging a record to the librarian's finalize", async ({ browser }) => {
  test.setTimeout(180_000);

  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
  const tag = Date.now().toString(36);
  const artist = `Juana Molina ${tag}`;
  const album = `DOGA ${tag}`;
  const label = "Sonamos";
  const reviewText = `A quiet record that rewards a second listen ${tag}.`;
  const editedText = `${reviewText} Edited after it was printed.`;

  const mdContext = await browser.newContext({ baseURL, storageState: path.join(authDir, INTAKE_MD_USER.stateFile) });
  const djContext = await browser.newContext({ baseURL, storageState: path.join(authDir, INTAKE_DJ_USER.stateFile) });
  // No print dialog may open: the slip is asserted in the page.
  await mdContext.addInitScript(() => {
    window.print = () => {};
  });
  const md = await mdContext.newPage();
  const dj = await djContext.newPage();

  const shelfRow = (page: Page) =>
    page.getByRole("region", { name: COPY.screen.shelfTitle }).getByRole("listitem").filter({ hasText: album });
  const checkoutRow = (page: Page) =>
    page.getByRole("region", { name: COPY.screen.checkoutsTitle }).getByRole("listitem").filter({ hasText: album });
  const laneRow = (page: Page, lane: RegExp) =>
    page.getByRole("region", { name: lane }).getByRole("listitem").filter({ hasText: album });

  let itemId = 0;
  let reviewId = 0;
  let albumId = 0;

  try {
    await test.step("1. the music director logs a disc", async () => {
      // A failed earlier run may have left this account on the classic interface.
      await setExperienceViaAccount(md, "modern", "/dashboard/reviews/music-directors");

      const form = md.getByRole("form", { name: COPY.intake.logTitle });
      await form.getByLabel(new RegExp(`^${COPY.intake.artist}`)).fill(artist);
      await form.getByLabel(new RegExp(`^${COPY.intake.album}`)).fill(album);
      // The path walks a disc: Format shows once the record arrived as a disc or a record.
      await form.getByRole("radio", { name: COPY.intake.arrivedAsDisc }).click();
      await form.getByRole("combobox", { name: new RegExp(`^${COPY.intake.format}`) }).click();
      await md.getByRole("option").first().click();
      // Leaving the page before the POST is sent would drop the write, so wait for the backend to answer it.
      const logged = md.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/intake"));
      await form.getByRole("button", { name: COPY.intake.log }).click();
      expect((await logged).ok()).toBe(true);

      await md.goto("/dashboard/reviews");
      await expect(shelfRow(md)).toBeVisible({ timeout: 15000 });
    });

    await test.step("2. the DJ checks it out, writes and submits a review; the record stays on the list", async () => {
      await dj.goto("/dashboard/reviews");
      const checkedOut = dj.waitForResponse((r) => r.request().method() === "POST" && /\/intake\/\d+\/checkout$/.test(new URL(r.url()).pathname));
      await shelfRow(dj).getByRole("button", { name: COPY.screen.checkOut, exact: true }).click();
      expect((await checkedOut).ok()).toBe(true);

      await dj.goto("/dashboard/reviews/mine");
      const row = checkoutRow(dj);
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByRole("button", { name: COPY.writeReview }).click();

      await dj.waitForURL(/\/dashboard\/reviews\/\d+$/, { timeout: 15000 });
      reviewId = Number(new URL(dj.url()).pathname.split("/").pop());

      await dj.getByRole("textbox", { name: COPY.fields.review.label, exact: true }).fill(reviewText);
      await dj.getByRole("button", { name: COPY.submit, exact: true }).click();
      // The confirmation is ConfirmDialog's default role, alertdialog, not dialog.
      await dj.getByRole("alertdialog").getByRole("button", { name: COPY.submit, exact: true }).click();
      await expect(dj.getByText(COPY.submittedBanner)).toBeVisible({ timeout: 15000 });

      await dj.goto("/dashboard/reviews/mine");
      const submitted = checkoutRow(dj);
      await expect(submitted).toBeVisible({ timeout: 15000 });
      await expect(submitted.getByText(COPY.screen.reviewSubmitted)).toBeVisible();
    });

    await test.step("3. the music director sees whose review it is and chooses it", async () => {
      await md.goto("/dashboard/reviews/music-directors");
      const waiting = laneRow(md, new RegExp(`^${escapeRegExp(COPY.intake.waiting)}`));
      await expect(waiting.getByText(COPY.intake.fromHolder(INTAKE_DJ_USER.realName))).toBeVisible({ timeout: 15000 });

      await waiting.getByRole("link", { name: artist, exact: true }).click();
      await md.waitForURL(/\/dashboard\/admin\/intake\/\d+$/, { timeout: 15000 });
      itemId = Number(new URL(md.url()).pathname.split("/").pop());

      const others = md.locator("section").filter({ has: md.getByRole("heading", { name: COPY.albumPanel.others }) });
      await expect(others.getByText(reviewText)).toBeVisible({ timeout: 15000 });
      await md.getByRole("button", { name: COPY.intakeItem.useThisReview, exact: true }).click();
      await expect(md.getByRole("heading", { name: COPY.albumPanel.coverOne })).toBeVisible({ timeout: 15000 });

      await md.goto("/dashboard/reviews/music-directors");
      const reviewed = laneRow(md, new RegExp(`^${escapeRegExp(COPY.intake.reviewed)}`));
      await expect(reviewed).toBeVisible({ timeout: 15000 });
      await expect(reviewed.getByText(`${COPY.intake.stillOutTo} ${INTAKE_DJ_USER.realName}`)).toBeVisible();
    });

    await test.step("4. the music director opens the slip, then files the record to the library", async () => {
      await md.goto(`/dashboard/admin/intake/${itemId}`);
      await md.getByRole("link", { name: COPY.intakeItem.printSlip, exact: true }).click();
      await md.waitForURL(/\/slip$/, { timeout: 15000 });
      await md.getByRole("button", { name: COPY.intakeItem.printSlip, exact: true }).click();
      await expect(md.getByRole("group", { name: COPY.slip.name })).toContainText(reviewText, { timeout: 15000 });

      await md.goto(`/dashboard/admin/intake/${itemId}`);
      await md.getByRole("radio", { name: COPY.intakeItem.fileNew }).check();

      const bench = md.getByRole("region", { name: COPY.intakeItem.fileIt });
      await bench.getByRole("combobox", { name: "Genre" }).click();
      await md.getByRole("option", { name: "Rock", exact: true }).click();

      // The logged name is pre-filled; retyping it starts the typeahead's search.
      const artistInput = bench.getByPlaceholder("Search artists...");
      await artistInput.fill("");
      await artistInput.pressSequentially(artist);
      await md.getByRole("option", { name: NEW_ARTIST_ROW(artist) }).click();
      // A new artist's call letters are suggested and its code number is the server's to assign.
      await expect(bench.getByLabel("Call letters")).not.toHaveValue("", { timeout: 15000 });

      await bench.getByLabel("Label", { exact: true }).fill(label);
      // The bench starts with rotation bin H selected; a rotation entry would hide the record from the finalize list.
      await bench.getByRole("checkbox", { name: "Heavy rotation" }).click();

      const filed = md.waitForResponse(
        (response) => /\/intake\/\d+\/file$/.test(new URL(response.url()).pathname) && response.request().method() === "POST",
      );
      await bench.getByRole("button", { name: "File to library" }).click();
      const response = await filed;
      expect(response.ok()).toBe(true);
      albumId = (await response.json()).album_id;
      expect(albumId).toEqual(expect.any(Number));

      await expect(md.getByText(COPY.intakeItem.filed, { exact: true })).toBeVisible({ timeout: 15000 });
    });

    await test.step("5. the DJ edits the review after it was printed, and the save succeeds", async () => {
      // Filing cleared the holder, so the record has left the DJ's checkout list; the review is still theirs under My reviews.
      await dj.goto("/dashboard/reviews/mine");
      const mine = dj.getByRole("region", { name: COPY.myReviews.title }).getByRole("listitem").filter({ hasText: album });
      await mine.getByRole("link", { name: COPY.myReviews.open }).click();
      await dj.waitForURL(new RegExp(`/dashboard/reviews/${reviewId}$`), { timeout: 15000 });

      await dj.getByRole("textbox", { name: COPY.fields.review.label, exact: true }).fill(editedText);
      await dj.getByRole("button", { name: COPY.save, exact: true }).click();
      // Leaving a dirty editor raises a prompt, so wait for the save to land first.
      await expect(dj.getByText(COPY.savedChange, { exact: true })).toBeVisible({ timeout: 15000 });
    });

    await test.step("6. the music director confirms the filed record in the classic librarian's list", async () => {
      await setExperienceViaAccount(md, "classic", "/dashboard/help");
      await md.goto("/dashboard/rotation?status=uncataloged");

      const table = md.getByRole("table", { name: "Filed, awaiting your confirmation" });
      const row = table.getByRole("row").filter({ hasText: album });
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByRole("button", { name: `Confirm: ${album}` }).click();
      await expect(row).toHaveCount(0, { timeout: 15000 });

      // The album page below is a modern screen.
      await setExperienceViaAccount(md, "modern", "/dashboard/reviews");
    });

    await test.step("7. the album page shows the edited review on the cover, with its printed version", async () => {
      await md.goto(`/dashboard/album/${albumId}`);
      const panel = md.locator('[aria-label="Album detail"]');
      const onCover = panel.locator("section").filter({ has: md.getByRole("heading", { name: COPY.albumPanel.coverOne }) });
      const entry = onCover.getByRole("listitem");
      await expect(entry).toHaveCount(1, { timeout: 15000 });
      await expect(entry).toContainText(editedText);

      await expect(entry.getByRole("link", { name: COPY.albumPanel.history })).toHaveAttribute(
        "href",
        `/dashboard/reviews/${reviewId}/history`,
      );
      await expect(entry.getByText(aroundValue(COPY.printedNote.edited))).toBeVisible();
      await expect(entry.getByRole("link", { name: COPY.printedNote.seePrinted })).toHaveAttribute(
        "href",
        `/dashboard/reviews/${reviewId}/history#printed`,
      );

      // Printed, then edited, and on the release's cover: the print link is named for a new slip.
      const newSlip = entry.getByRole("link", { name: COPY.printedNote.printNew, exact: true });
      await expect(newSlip).toHaveCount(1);
      await expect(newSlip).toHaveAttribute("href", `/dashboard/admin/library/${albumId}/slip/${reviewId}`);
      await expect(entry.getByRole("link", { name: COPY.intakeItem.printSlip, exact: true })).toHaveCount(0);
    });
  } finally {
    await mdContext.close().catch(() => {});
    await djContext.close().catch(() => {});
  }
});
