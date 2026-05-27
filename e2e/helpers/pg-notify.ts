import { Client } from "pg";

/**
 * Fire a Postgres NOTIFY from a Playwright test, so tests can bypass the
 * LML enrichment chain and exercise just the CDC → broadcast → SSE → DOM
 * segment. Connection env vars are exported by scripts/e2e-local.sh and the
 * E2E workflow — throws on missing config so misconfigured CI surfaces
 * loudly rather than silently connecting to the wrong place.
 */
function getDbConfig() {
  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USERNAME", "DB_PASSWORD"] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `pg-notify: missing required env vars: ${missing.join(", ")}. ` +
        `Ensure scripts/e2e-local.sh (or the CI workflow) exports DB_* before running Playwright.`
    );
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  };
}

export async function pgNotify(channel: string, payload: object): Promise<void> {
  const client = new Client(getDbConfig());
  await client.connect();
  try {
    // NOTIFY's payload must be a SQL literal — parameter binding is not
    // allowed. JSON.stringify never produces backslash-escaped single quotes,
    // so SQL single-quote doubling is sufficient.
    const literal = JSON.stringify(payload).replace(/'/g, "''");
    await client.query(`NOTIFY ${channel}, '${literal}'`);
  } finally {
    await client.end();
  }
}
