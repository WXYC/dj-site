/**
 * Canonical post-authentication landing page. Every site that reads
 * NEXT_PUBLIC_DASHBOARD_HOME_PAGE falls back to this when the env var is unset,
 * so an environment that loses it (preview deploy, fresh fork) lands every entry
 * point — `/`, `/dashboard`, `/login`, the not-found card — on the same page (#632).
 *
 * MUST MATCH the literal in next.config.mjs and the default in .env.example.
 * next.config.mjs cannot import TypeScript, so it repeats the value under a
 * comment naming this constant — change all three together.
 */
export const DEFAULT_DASHBOARD_HOME_PAGE = "/dashboard/catalog";
