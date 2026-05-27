import type { Browser } from "@playwright/test";
import { FlowsheetPage } from "../pages/flowsheet.page";

/**
 * Spin up a fresh authed context just to call `ensureOffAir`. Used by SSE
 * spec files' `afterAll` hooks where the test browser context has been
 * mutated (e.g., `setOffline`) and reusing it for cleanup would be
 * unreliable.
 */
export async function ensureOffAirInFreshContext(
  browser: Browser,
  storageState: string
): Promise<void> {
  const context = await browser.newContext({ storageState });
  try {
    const page = await context.newPage();
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureOffAir();
  } finally {
    await context.close();
  }
}
