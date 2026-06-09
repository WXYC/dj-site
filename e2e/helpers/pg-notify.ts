import { Client } from "pg";
import { requireEnv } from "./env";

/**
 * Fire a Postgres NOTIFY from a Playwright test, so tests can bypass the
 * LML enrichment chain and exercise just the CDC → broadcast → SSE → DOM
 * segment. Connection env vars are exported by scripts/e2e-local.sh and the
 * E2E workflow — throws on missing config so misconfigured CI surfaces
 * loudly rather than silently connecting to the wrong place.
 */
function getDbConfig() {
  const env = requireEnv("pg-notify", [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USERNAME",
    "DB_PASSWORD",
  ]);
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
  };
}

export async function pgNotify(channel: string, payload: object): Promise<void> {
  const client = new Client(getDbConfig());
  await client.connect();
  try {
    // NOTIFY accepts neither parameter binding for the channel nor parameter
    // binding for the payload. `escapeIdentifier` is the only safe path for
    // the channel name; single-quote doubling is sufficient for the JSON
    // payload (JSON.stringify never emits backslash-escaped single quotes).
    const quotedChannel = client.escapeIdentifier(channel);
    const literal = JSON.stringify(payload).replace(/'/g, "''");
    await client.query(`NOTIFY ${quotedChannel}, '${literal}'`);
  } finally {
    await client.end();
  }
}
