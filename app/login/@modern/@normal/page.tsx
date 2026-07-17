import { redirect } from "next/navigation";
import {
  getServerSession,
  isUserIncomplete,
} from "@/lib/features/authentication/server-utils";
import { getOidcRedirectTarget } from "@/src/utilities/oidcRedirectTarget";
import LoginFormSwitcher from "@/src/components/experiences/modern/login/Forms/LoginFormSwitcher";
import { pickWelcomeQuote } from "@/src/components/experiences/modern/login/Quotes/Welcome";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";

const DASHBOARD_HOME_PAGE =
  process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || DEFAULT_DASHBOARD_HOME_PAGE;

/**
 * The @normal slot renders for every /login visit — its output is passed to the
 * client LoginSlotSwitcher as the `normal` prop regardless of which slot is
 * ultimately shown — and, unlike a layout, a page receives `searchParams`. That
 * makes it the right place to resume an OIDC authorize round-trip for an
 * already-signed-in user.
 *
 * Previously app/login/@modern/layout.tsx unconditionally redirected a
 * signed-in, verified, onboarding-complete user to the dashboard. That fired
 * before anything could read the query string, so an OIDC "Sign in with WXYC"
 * bounce to /login?client_id=…&response_type=code lost its params and the
 * authorize round-trip was abandoned (#762). A layout cannot read searchParams,
 * and Next 16 middleware/proxy runs only on the Node.js runtime, which the
 * OpenNext/Cloudflare adapter rejects — so the decision lives here instead.
 *
 * When the visitor is authenticated, verified, and complete we redirect
 * server-side: to the OIDC authorize endpoint when the request carries
 * authorize params, otherwise to the dashboard as before. A 307 is a real
 * top-level navigation, so — unlike router.push — it neither flashes the login
 * form nor fires a background RSC fetch that would burn the one-time OIDC code
 * (see #761). The same-origin /auth target is served by
 * app/auth/[...path]/route.ts, which forwards session cookies intact.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession();

  if (session?.user?.emailVerified && !isUserIncomplete(session)) {
    const params = toSearchParams(await searchParams);
    const oidcTarget = getOidcRedirectTarget(params, "/auth");
    redirect(oidcTarget ?? DASHBOARD_HOME_PAGE);
  }

  return <LoginFormSwitcher welcomeQuote={pickWelcomeQuote()} />;
}

function toSearchParams(raw: {
  [key: string]: string | string[] | undefined;
}): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}
