/** @type {import('next').NextConfig} */
// NOTE: `/auth/*` is NOT proxied here. It used to be a `/auth/:path*` rewrite,
// but on the OpenNext/Cloudflare Workers runtime a rewrite folds multiple
// `Set-Cookie` response headers into one (opennextjs-cloudflare#501), which
// broke better-auth sign-out and trapped stale-cookie profiles in a login loop.
// Proxying now lives in `app/auth/[...path]/route.ts`, which re-emits each
// `Set-Cookie` individually. Do not re-add an `/auth` rewrite here.

// `NEXT_DIST_DIR_SUFFIX` lets parallel builds (different NEXT_PUBLIC_* values
// in particular) coexist by writing to `.next-<suffix>/` instead of the
// default `.next/`. No application semantics — set by scripts that need a
// second build alongside the primary one.
const distDir = process.env.NEXT_DIST_DIR_SUFFIX
  ? `.next-${process.env.NEXT_DIST_DIR_SUFFIX}`
  : ".next";

// --- Security headers (#631) -------------------------------------------------
// The CSP ships as Content-Security-Policy-Report-Only for the first rollout:
// on Cloudflare Pages / OpenNext a too-tight policy can break the site
// invisibly, so this observes violations (browser console) without enforcing.
// Every directive below traces to an observed load in the codebase:
//
//   script-src   'unsafe-inline' — Next.js App Router injects inline hydration/
//                bootstrap scripts and has no nonce pipeline here. PostHog
//                (lib/posthog.ts) lazy-loads its recorder/exception-autocapture
//                bundles from the region "-assets" host.
//   style-src    'unsafe-inline' — MUI Joy UI / Emotion inject runtime <style>
//                tags and inline style attributes; next/font emits inline
//                @font-face. All self-hosted; no external stylesheet origins.
//   img-src      https: — album artwork (album.artwork_url, useAlbumArtwork)
//                is resolved by the backend /metadata proxy and points at
//                third-party image hosts not enumerable at build time; data:/
//                blob: cover inline SVG and canvas.
//   font-src     'self' data: — next/font self-hosts under /_next/static; no
//                fonts.googleapis/gstatic requests exist. data: is defensive.
//   media-src    audio-mp3.ibiblio.org — the live stream AUDIO_SRC in
//                src/widgets/NowPlaying/index.tsx.
//   connect-src  backend origin — RTK Query (lib/features/backend.ts) and the
//                SSE EventSource (lib/features/flowsheet/live-updates-listener.ts)
//                hit NEXT_PUBLIC_BACKEND_URL directly; PostHog host + assets for
//                telemetry; orchestrator origin when NEXT_PUBLIC_ORCHESTRATOR_URL
//                is set (lib/features/autoDJ/api.ts). Auth is same-origin: the
//                client resolves a cross-origin NEXT_PUBLIC_BETTER_AUTH_URL to
//                the local /auth proxy (lib/features/authentication/client.ts),
//                so 'self' covers it.
//   frame-ancestors 'none' — nothing embeds dj-site in an iframe (grep found no
//                self-framing); mirrors X-Frame-Options: DENY.
//
// NEXT_PUBLIC_* values are inlined at build time, so the derived origins below
// resolve to the environment being built (prod vs preview vs local).
function originOf(url) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// PostHog cloud serves the recorder / exception-autocapture assets from the
// region "-assets" host (us.i -> us-assets.i). Self-hosted deployments serve
// them from the same host, so a non-matching origin is returned unchanged.
// Only the ^https://<region>.i.posthog.com$ shape is rewritten: a custom or
// proxied NEXT_PUBLIC_POSTHOG_HOST that still lazy-loads from a "-assets"
// host will need that origin added here manually.
function posthogAssetsOrigin(origin) {
  if (!origin) return null;
  return origin.replace(
    /^https:\/\/([a-z0-9-]+)\.i\.posthog\.com$/,
    "https://$1-assets.i.posthog.com"
  );
}

const AUDIO_STREAM_ORIGIN = "https://audio-mp3.ibiblio.org";

export function buildContentSecurityPolicy(env = process.env) {
  const backendOrigin = originOf(env.NEXT_PUBLIC_BACKEND_URL);
  const orchestratorOrigin = originOf(env.NEXT_PUBLIC_ORCHESTRATOR_URL);
  const posthogOrigin = originOf(
    env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
  );
  const posthogAssets = posthogAssetsOrigin(posthogOrigin);

  const dedupe = (values) => [...new Set(values.filter(Boolean))];

  const scriptSrc = dedupe([
    "'self'",
    "'unsafe-inline'",
    posthogOrigin,
    posthogAssets,
  ]);
  const connectSrc = dedupe([
    "'self'",
    backendOrigin,
    orchestratorOrigin,
    posthogOrigin,
    posthogAssets,
  ]);

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    `media-src 'self' ${AUDIO_STREAM_ORIGIN}`,
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(env = process.env) {
  const headers = [
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(env),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];

  // NODE_ENV === "production" does NOT mean "production deploys only": `next
  // build` sets it for EVERY build, previews included, so HSTS ships on
  // *.wxyc-dj.pages.dev too (harmless — pages.dev is already HSTS-preloaded).
  // The gate's only real effect is excluding `next dev`, where a max-age on a
  // local http origin would pin the browser to https it doesn't serve.
  // Cutover caveat: preload + includeSubDomains + 2y max-age is sticky on the
  // eventual custom domain — be deliberate before flipping DNS to this app.
  if (env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
  distDir,
  // Explicitly set workspace root to silence lockfile warning
  outputFileTracingRoot: import.meta.dirname,
  // Required for OpenNext Cloudflare
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ];
  },
  async redirects() {
    return [
      {
        // The dashboard layout uses parallel routes and doesn't render the
        // children slot, so app/dashboard/page.tsx's redirect() never fires.
        // Handle it here instead.
        source: "/dashboard",
        // MUST MATCH DEFAULT_DASHBOARD_HOME_PAGE in
        // lib/features/application/constants.ts. This file is plain ESM loaded
        // by the Next build and cannot import the TypeScript constant, so the
        // literal is duplicated here under this comment — change both together.
        destination:
          process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

// OpenNext Cloudflare dev initialization
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
