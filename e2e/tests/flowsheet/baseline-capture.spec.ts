import { test } from "@playwright/test";
import path from "path";

const BASELINE_DIR = path.join(
  __dirname,
  "../../../docs/plans/flowsheet-entry-redesign/baseline"
);

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "900", width: 900, height: 800 },
  { name: "600", width: 600, height: 800 },
  { name: "375", width: 375, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`baseline @ ${vp.name}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`idle light`, async ({ page }) => {
      await page.goto("/dashboard/flowsheet");
      await page.waitForSelector('[data-testid="flowsheet-search-form"]');
      await page.screenshot({
        path: path.join(BASELINE_DIR, `${vp.name}-idle-light.png`),
        fullPage: false,
      });
    });
  });
}
