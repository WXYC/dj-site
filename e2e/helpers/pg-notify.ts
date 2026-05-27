import { Client } from "pg";

/**
 * Fire a Postgres NOTIFY from a Playwright test.
 *
 * The Backend-Service SSE pipeline subscribes to LISTEN 'cdc' and broadcasts
 * matching events to connected EventSource clients. Tests use this to skip
 * the LML enrichment chain (unreachable in CI) and exercise just the
 * CDC -> broadcast -> SSE -> DOM segment.
 *
 * Reads DB connection details from environment variables — `scripts/e2e-local.sh`
 * and `.github/workflows/e2e-tests.yml` both export DB_HOST/PORT/NAME/USERNAME/
 * PASSWORD. Throws if any are missing so misconfigured CI surfaces loudly
 * instead of silently connecting to the wrong place.
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
